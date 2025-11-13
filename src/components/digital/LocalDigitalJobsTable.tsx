import { useState, useEffect } from "react";
import { Plus, Trash2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useDigitalSettings } from "@/hooks/useDigitalSettings";
import { useDigitalPriceList } from "@/hooks/useDigitalPriceList";
import { computeDigitalJob } from "@/lib/digitalCalculations";
import { useToast } from "@/hooks/use-toast";

export interface LocalDigitalJob {
  file_name: string;
  finished_w_mm: number;
  finished_h_mm: number;
  pages: number;
  qty: number;
  is_test_print: boolean;
  print_sides: string; // e.g. "4/4", "4/0", etc.
  computed_nup?: number;
  computed_sheets_per_copy?: number;
  computed_total_sheets?: number;
  computed_color_clicks?: number;
  computed_mono_clicks?: number;
  computed_price_per_sheet?: number;
  computed_line_total?: number;
}

interface LocalDigitalJobsTableProps {
  jobs: LocalDigitalJob[];
  onChange: (jobs: LocalDigitalJob[]) => void;
  printSides: string; // From parent form (e.g. "4/4")
  clientRabatProcenat?: number;
}

export const LocalDigitalJobsTable = ({ jobs, onChange, printSides, clientRabatProcenat }: LocalDigitalJobsTableProps) => {
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const { data: settings } = useDigitalSettings();
  const { data: priceList } = useDigitalPriceList();
  const { toast } = useToast();

  // Recompute all jobs when settings, priceList, or printSides change
  useEffect(() => {
    if (!settings || !priceList || priceList.length === 0) return;

    const updatedJobs = jobs.map(job => {
      const result = computeDigitalJob(
        { ...job, print_sides: printSides },
        settings,
        priceList
      );

      if ('error' in result) {
        return job; // Keep original if error
      }

      return {
        ...job,
        print_sides: printSides,
        ...result,
      };
    });

    // Only update if something changed
    const hasChanges = updatedJobs.some((job, i) => 
      job.computed_nup !== jobs[i].computed_nup ||
      job.computed_total_sheets !== jobs[i].computed_total_sheets ||
      job.computed_line_total !== jobs[i].computed_line_total
    );

    if (hasChanges) {
      onChange(updatedJobs);
    }
  }, [jobs.length, settings, priceList, printSides]);

  const handleAdd = () => {
    const newJob: LocalDigitalJob = {
      file_name: "",
      finished_w_mm: 0,
      finished_h_mm: 0,
      pages: 1,
      qty: 1,
      is_test_print: false,
      print_sides: printSides,
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
    updated[index] = { ...updated[index], [field]: value, print_sides: printSides };

    // Recompute immediately after field change
    if (settings && priceList && priceList.length > 0) {
      const result = computeDigitalJob(
        { ...updated[index], print_sides: printSides },
        settings,
        priceList
      );

      if ('error' in result) {
        toast({
          title: "Greška",
          description: result.error,
          variant: "destructive",
        });
      } else {
        updated[index] = { ...updated[index], ...result };
      }
    }

    onChange(updated);
  };

  const handleAddJobs = (newJobs: LocalDigitalJob[]) => {
    onChange([...jobs, ...newJobs]);
    
    // Focus on first pages input after a short delay
    setTimeout(() => {
      const firstPagesInput = document.querySelector<HTMLInputElement>(
        `input[type="number"][value="1"]`
      );
      if (firstPagesInput) {
        firstPagesInput.focus();
        firstPagesInput.select();
      }
    }, 100);
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
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Naziv fajla</TableHead>
                <TableHead className="w-[90px]">Širina (mm)</TableHead>
                <TableHead className="w-[90px]">Visina (mm)</TableHead>
                <TableHead className="w-[80px]">Strane</TableHead>
                <TableHead className="w-[80px]">Količina</TableHead>
                <TableHead className="w-[100px] text-center">Probna štampa</TableHead>
                <TableHead className="w-[70px] text-right">NUP</TableHead>
                <TableHead className="w-[90px] text-right">Tab/kom</TableHead>
                <TableHead className="w-[90px] text-right">Ukupno tab</TableHead>
                <TableHead className="w-[80px] text-right">Color</TableHead>
                <TableHead className="w-[80px] text-right">Mono</TableHead>
                <TableHead className="w-[90px] text-right">€/tab</TableHead>
                <TableHead className="w-[100px] text-right">Iznos (€)</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={job.file_name}
                      onChange={(e) => handleFieldChange(index, 'file_name', e.target.value)}
                      placeholder="Naziv fajla"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={job.finished_w_mm || ''}
                      onChange={(e) => handleFieldChange(index, 'finished_w_mm', parseInt(e.target.value) || 0)}
                      placeholder="mm"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={job.finished_h_mm || ''}
                      onChange={(e) => handleFieldChange(index, 'finished_h_mm', parseInt(e.target.value) || 0)}
                      placeholder="mm"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={job.pages || ''}
                      onChange={(e) => handleFieldChange(index, 'pages', parseInt(e.target.value) || 1)}
                      min={1}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={job.qty || ''}
                      onChange={(e) => handleFieldChange(index, 'qty', parseInt(e.target.value) || 1)}
                      min={1}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={job.is_test_print}
                      onCheckedChange={(checked) => handleFieldChange(index, 'is_test_print', checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {job.computed_nup || '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {job.computed_sheets_per_copy || '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {job.computed_total_sheets || '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {job.computed_color_clicks || '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {job.computed_mono_clicks || '-'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {job.computed_price_per_sheet ? `€${job.computed_price_per_sheet.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {job.computed_line_total !== undefined ? `€${job.computed_line_total.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
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
