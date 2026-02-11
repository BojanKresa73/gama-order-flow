import { useState, useRef } from "react";
import { Plus, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddFilmJobsModal } from "./AddFilmJobsModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FilmItemRow, { FilmRow } from "./FilmItemRow";

export interface LocalFilmJob extends FilmRow {
  allow_rotate_90: boolean;
  margin_mm: number;
  note?: string;
}

interface LocalFilmJobsTableProps {
  jobs: LocalFilmJob[];
  onChange: (jobs: LocalFilmJob[]) => void;
}

export const LocalFilmJobsTable = ({ jobs, onChange }: LocalFilmJobsTableProps) => {
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Commit handler for individual rows
  const handleRowCommit = (id: string, patch: Partial<FilmRow>) => {
    const updated = jobs.map((job) =>
      job.id === id ? { ...job, ...patch } : job
    );
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      onChange(jobs.filter((job) => job.id !== id));
    }
  };

  const handleAddItem = () => {
    const newJob: LocalFilmJob = {
      id: crypto.randomUUID(),
      file_name: `Stavka ${jobs.length + 1}`,
      width_mm: 0,
      height_mm: 0,
      quantity: 1,
      allow_rotate_90: true,
      margin_mm: 0,
    };
    onChange([...jobs, newJob]);
  };

  const handleAddMultipleJobs = (newJobs: LocalFilmJob[]) => {
    const startIndex = jobs.length;
    const jobsWithIds = newJobs.map(job => ({
      ...job,
      id: job.id || crypto.randomUUID(),
    }));
    onChange([...jobs, ...jobsWithIds]);
    
    // Focus first width input of newly added jobs after a short delay
    setTimeout(() => {
      const firstNewInput = inputRefs.current[`${startIndex}-width`];
      if (firstNewInput) {
        firstNewInput.focus();
        firstNewInput.select();
      }
    }, 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Stavke filmovanja</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAddFilesModal(true)}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Dodaj fajlove
          </Button>
          <Button
            type="button"
            onClick={handleAddItem}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj stavku
          </Button>
        </div>
      </div>

      <AddFilmJobsModal
        open={showAddFilesModal}
        onOpenChange={setShowAddFilesModal}
        onAddJobs={handleAddMultipleJobs}
      />

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv fajla</TableHead>
              <TableHead>Širina (mm)</TableHead>
              <TableHead>Visina (mm)</TableHead>
              <TableHead>Količina</TableHead>
              <TableHead>Kom. po širini</TableHead>
              <TableHead>Orijentacija</TableHead>
              <TableHead>m/kom</TableHead>
              <TableHead>Ukupno m</TableHead>
              <TableHead className="w-[100px]">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nema stavki. Dodajte stavku ili importujte fajlove.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job, index) => (
                <TableRow key={job.id}>
                  <FilmItemRow
                    row={job}
                    index={index}
                    onCommit={handleRowCommit}
                    onDelete={handleDelete}
                    inputRefs={inputRefs}
                  />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {jobs.length > 0 && (
        <div className="flex justify-end">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-8">
              <span className="font-medium">Ukupno stavki:</span>
              <span>{jobs.length}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="font-medium">Ukupno komada:</span>
              <span>{jobs.reduce((sum, job) => sum + (job.quantity || 0), 0)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="font-medium">Ukupna dužina filma:</span>
              <span className="font-bold">
                {jobs.reduce((sum, job) => sum + (job.computed_total_m || 0), 0).toFixed(2)} m
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
