import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddFilmJobsModal } from "./AddFilmJobsModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { computeFilmJobClient } from "@/lib/filmCalculations";
import { useToast } from "@/hooks/use-toast";

export interface LocalFilmJob {
  file_name: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  allow_rotate_90: boolean;
  margin_mm: number;
  note?: string;
  computed_rotation_deg?: number;
  computed_m_per_piece?: number;
  computed_total_m?: number;
}

interface LocalFilmJobsTableProps {
  jobs: LocalFilmJob[];
  onChange: (jobs: LocalFilmJob[]) => void;
}

export const LocalFilmJobsTable = ({ jobs, onChange }: LocalFilmJobsTableProps) => {
  const [computedJobs, setComputedJobs] = useState<Record<number, any>>({});
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<number, { width?: string; height?: string; qty?: string }>>({});
  const { toast } = useToast();
  const debounceTimers = useRef<Record<number, NodeJS.Timeout>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Compute all jobs
  useEffect(() => {
    const computeAllJobs = async () => {
      const { data: settings } = await supabase
        .from('film_settings')
        .select('*')
        .single();
      
      if (settings) {
        const computed: Record<number, any> = {};
        const errors: Record<number, { width?: string; height?: string; qty?: string }> = {};
        
        jobs.forEach((job, index) => {
          // Validate
          if (job.width_mm > 500) {
            errors[index] = { ...errors[index], width: "Preširoko za rolu (max 500 mm)" };
          }
          if (job.width_mm < 10 && job.width_mm > 0) {
            errors[index] = { ...errors[index], width: "Minimalna širina je 10 mm" };
          }
          if (job.height_mm < 10 && job.height_mm > 0) {
            errors[index] = { ...errors[index], height: "Minimalna visina je 10 mm" };
          }
          if (job.qty < 1 && job.qty > 0) {
            errors[index] = { ...errors[index], qty: "Minimalna količina je 1" };
          }
          
          // Compute if valid
          if (job.width_mm && job.height_mm && job.qty && !errors[index]?.width) {
            const result = computeFilmJobClient(job, settings);
            if (!('error' in result)) {
              computed[index] = result;
            }
          }
        });
        
        setComputedJobs(computed);
        setValidationErrors(errors);
      }
    };
    
    computeAllJobs();
  }, [jobs]);

  const handleFieldChange = (index: number, field: keyof LocalFilmJob, value: number) => {
    // Clear existing debounce timer
    if (debounceTimers.current[index]) {
      clearTimeout(debounceTimers.current[index]);
    }

    // Update job immediately
    const updated = [...jobs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);

    // Validate width
    if (field === 'width_mm' && value > 500) {
      toast({
        title: "Greška",
        description: "Preširoko za rolu (max 500 mm)",
        variant: "destructive",
      });
    }

    // Debounce computation
    debounceTimers.current[index] = setTimeout(() => {
      // Computation will happen automatically via useEffect
    }, 250);
  };

  const handleDelete = (index: number) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      onChange(jobs.filter((_, i) => i !== index));
    }
  };

  const handleAddItem = () => {
    onChange([
      ...jobs,
      {
        file_name: `Stavka ${jobs.length + 1}`,
        width_mm: 0,
        height_mm: 0,
        qty: 1,
        allow_rotate_90: true,
        margin_mm: 0,
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, field: 'width' | 'height' | 'qty') => {
    const fieldOrder = ['width', 'height', 'qty'];
    const currentFieldIndex = fieldOrder.indexOf(field);

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      
      // Move to next field or next row
      if (currentFieldIndex < fieldOrder.length - 1) {
        // Next field in same row
        const nextField = fieldOrder[currentFieldIndex + 1];
        const nextRef = inputRefs.current[`${rowIndex}-${nextField}`];
        nextRef?.focus();
        nextRef?.select();
      } else {
        // First field in next row
        const nextRef = inputRefs.current[`${rowIndex + 1}-width`];
        if (nextRef) {
          nextRef.focus();
          nextRef.select();
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRef = inputRefs.current[`${rowIndex + 1}-${field}`];
      if (nextRef) {
        nextRef.focus();
        nextRef.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRef = inputRefs.current[`${rowIndex - 1}-${field}`];
      if (prevRef) {
        prevRef.focus();
        prevRef.select();
      }
    }
  };

  const handleAddMultipleJobs = (newJobs: LocalFilmJob[]) => {
    onChange([...jobs, ...newJobs]);
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
              <TableHead>m/kom</TableHead>
              <TableHead>Ukupno m</TableHead>
              <TableHead>Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nema stavki. Kliknite "Dodaj stavku" da dodate prvu.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{job.file_name}</TableCell>
                  <TableCell>
                    <Input
                      ref={(el) => (inputRefs.current[`${index}-width`] = el)}
                      type="number"
                      value={job.width_mm || ""}
                      onChange={(e) => handleFieldChange(index, 'width_mm', Number(e.target.value))}
                      onKeyDown={(e) => handleKeyDown(e, index, 'width')}
                      className={validationErrors[index]?.width ? "border-destructive" : ""}
                      min="10"
                      max="500"
                    />
                    {validationErrors[index]?.width && (
                      <span className="text-xs text-destructive">{validationErrors[index].width}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      ref={(el) => (inputRefs.current[`${index}-height`] = el)}
                      type="number"
                      value={job.height_mm || ""}
                      onChange={(e) => handleFieldChange(index, 'height_mm', Number(e.target.value))}
                      onKeyDown={(e) => handleKeyDown(e, index, 'height')}
                      className={validationErrors[index]?.height ? "border-destructive" : ""}
                      min="10"
                    />
                    {validationErrors[index]?.height && (
                      <span className="text-xs text-destructive">{validationErrors[index].height}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      ref={(el) => (inputRefs.current[`${index}-qty`] = el)}
                      type="number"
                      value={job.qty || ""}
                      onChange={(e) => handleFieldChange(index, 'qty', Math.floor(Number(e.target.value)))}
                      onKeyDown={(e) => handleKeyDown(e, index, 'qty')}
                      className={validationErrors[index]?.qty ? "border-destructive" : ""}
                      min="1"
                      step="1"
                    />
                    {validationErrors[index]?.qty && (
                      <span className="text-xs text-destructive">{validationErrors[index].qty}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {computedJobs[index] ? computedJobs[index].computed_m_per_piece.toFixed(4) : '-'}
                  </TableCell>
                  <TableCell>
                    {computedJobs[index] ? computedJobs[index].computed_total_m.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
