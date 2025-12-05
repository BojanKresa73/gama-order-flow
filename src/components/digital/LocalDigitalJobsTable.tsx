import { useState } from "react";
import { Plus, Trash2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddDigitalJobsModal } from "./AddDigitalJobsModal";
import { DigitalJobsSummary } from "./DigitalJobsSummary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDigitalPaperTypes } from "@/hooks/useDigitalPaperTypes";
import { SHEET_FORMATS, PRINT_MODES } from "@/lib/digitalCalculations";

export interface LocalDigitalJob {
  name?: string;
  file_name: string;
  finished_w_mm: number;
  finished_h_mm: number;
  pages: number;
  obim: number; // Number of imposed sheets per one finished copy
  qty: number; // Number of finished copies (Tiraž)
  is_test_print: boolean;
  print_sides: string; // "4/4", "4/0", "4/1", "1/0", "1/1"
  paper_type?: string;
  machine_sheet_format?: string; // "488x330" or "760x330"
  pieces_per_sheet_override?: number | null;
  test_sheets?: number;
  include_test_in_clicks?: boolean;
  finishing?: string;
  computed_nup?: number;
  computed_sheets_per_copy?: number;
  computed_total_sheets?: number;
  computed_color_clicks?: number;
  computed_mono_clicks?: number;
  computed_price_per_sheet?: number;
  computed_line_total?: number;
  cover_sheets?: number;
  lamination_sheets?: number;
  pieces_per_sheet?: number;
  sheets_for_production?: number;
  sheets_for_test?: number;
}

interface LocalDigitalJobsTableProps {
  jobs: LocalDigitalJob[];
  onChange: (jobs: LocalDigitalJob[]) => void;
  printSides: string;
  clientRabatProcenat?: number;
}

export const LocalDigitalJobsTable = ({ jobs, onChange, printSides, clientRabatProcenat }: LocalDigitalJobsTableProps) => {
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const { data: paperTypes } = useDigitalPaperTypes();

  const handleAdd = () => {
    const newJob: LocalDigitalJob = {
      name: "",
      file_name: "",
      finished_w_mm: 0,
      finished_h_mm: 0,
      pages: 1,
      obim: 1,
      qty: 1,
      is_test_print: false,
      print_sides: printSides || "4/4",
      paper_type: paperTypes?.[0]?.name || "",
      machine_sheet_format: "488x330",
      test_sheets: 0,
      include_test_in_clicks: false,
      finishing: "",
    };
    onChange([...jobs, newJob]);
  };

  const handleDelete = (index: number) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      onChange(jobs.filter((_, i) => i !== index));
    }
  };

  const handleFieldChange = (index: number, field: keyof LocalDigitalJob, value: any) => {
    const updated = [...jobs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddJobs = (newJobs: LocalDigitalJob[]) => {
    const jobsWithDefaults = newJobs.map(job => ({
      ...job,
      obim: job.obim || 1,
      paper_type: paperTypes?.[0]?.name || "",
      machine_sheet_format: "488x330",
      test_sheets: 0,
      include_test_in_clicks: false,
    }));
    onChange([...jobs, ...jobsWithDefaults]);
  };

  return (
    <div className="space-y-4">
      <DigitalJobsSummary jobs={jobs} clientRabatProcenat={clientRabatProcenat} />
      
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleAdd}
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj stavku
        </Button>
        <Button
          type="button"
          onClick={() => setShowAddFilesModal(true)}
          variant="outline"
          size="sm"
        >
          <FileUp className="h-4 w-4 mr-2" />
          Dodaj fajlove
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          Nema stavki. Kliknite "Dodaj stavku" ili "Dodaj fajlove" da započnete.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Naziv</TableHead>
                <TableHead className="w-[80px]">Obim</TableHead>
                <TableHead className="w-[90px]">Štampa</TableHead>
                <TableHead className="w-[90px]">Tiraž</TableHead>
                <TableHead className="w-[140px]">Papir</TableHead>
                <TableHead className="w-[120px]">Format tabaka</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job, index) => (
                <TableRow key={index}>
                  <TableCell className="py-2">
                    <Input
                      value={job.name || job.file_name || ''}
                      onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                      placeholder="Naziv stavke"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      value={job.obim || 1}
                      onChange={(e) => handleFieldChange(index, 'obim', Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      placeholder="Obim"
                      className="w-16 h-8"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Select
                      value={job.print_sides}
                      onValueChange={(v) => handleFieldChange(index, 'print_sides', v)}
                    >
                      <SelectTrigger className="h-8 w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRINT_MODES.map(mode => (
                          <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      value={job.qty || ''}
                      onChange={(e) => handleFieldChange(index, 'qty', parseInt(e.target.value) || 1)}
                      min={1}
                      placeholder="Kopije"
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Select
                      value={job.paper_type || ''}
                      onValueChange={(v) => handleFieldChange(index, 'paper_type', v)}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue placeholder="Papir" />
                      </SelectTrigger>
                      <SelectContent>
                        {paperTypes?.map(pt => (
                          <SelectItem key={pt.id} value={pt.name}>{pt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Select
                      value={job.machine_sheet_format || '488x330'}
                      onValueChange={(v) => handleFieldChange(index, 'machine_sheet_format', v)}
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHEET_FORMATS.map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDelete(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddDigitalJobsModal
        open={showAddFilesModal}
        onOpenChange={setShowAddFilesModal}
        onAddJobs={handleAddJobs}
      />
    </div>
  );
};
