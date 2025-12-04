import { useState, useEffect, Fragment } from "react";
import { Plus, Trash2, FileUp, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useDigitalSettings } from "@/hooks/useDigitalSettings";
import { useDigitalPriceList } from "@/hooks/useDigitalPriceList";
import { useDigitalPaperTypes } from "@/hooks/useDigitalPaperTypes";
import { computeDigitalJob, calculatePiecesPerSheet } from "@/lib/digitalCalculations";
import { useToast } from "@/hooks/use-toast";

export interface LocalDigitalJob {
  name?: string;
  file_name: string;
  finished_w_mm: number;
  finished_h_mm: number;
  pages: number;
  qty: number;
  is_test_print: boolean;
  print_sides: string;
  paper_type?: string;
  machine_sheet_format?: string;
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

const SHEET_FORMATS = ["330x488", "330x760"];
const PRINT_MODES = ["4/4", "4/0", "4/1", "1/1", "1/0"];
const FINISHING_OPTIONS = ["Sečenje", "Big", "Klamerica", "Spirala", "Lepljeno", "Bez dorade"];

export const LocalDigitalJobsTable = ({ jobs, onChange, printSides, clientRabatProcenat }: LocalDigitalJobsTableProps) => {
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const { data: settings } = useDigitalSettings();
  const { data: priceList } = useDigitalPriceList();
  const { data: paperTypes } = useDigitalPaperTypes();
  const { toast } = useToast();

  // Recompute all jobs when settings or priceList change
  useEffect(() => {
    if (!settings || !priceList || priceList.length === 0) return;

    const updatedJobs = jobs.map(job => {
      const result = computeDigitalJob(
        { ...job, print_sides: job.print_sides || printSides },
        settings,
        priceList
      );

      if ('error' in result) {
        return job;
      }

      return {
        ...job,
        ...result,
      };
    });

    const hasChanges = updatedJobs.some((job, i) => 
      job.computed_nup !== jobs[i].computed_nup ||
      job.computed_total_sheets !== jobs[i].computed_total_sheets ||
      job.computed_line_total !== jobs[i].computed_line_total
    );

    if (hasChanges) {
      onChange(updatedJobs);
    }
  }, [jobs.length, settings, priceList]);

  const toggleRowExpanded = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleAdd = () => {
    const newJob: LocalDigitalJob = {
      name: "",
      file_name: "",
      finished_w_mm: 0,
      finished_h_mm: 0,
      pages: 1,
      qty: 1,
      is_test_print: false,
      print_sides: printSides,
      paper_type: paperTypes?.[0]?.name || "",
      machine_sheet_format: "330x488",
      test_sheets: 0,
      include_test_in_clicks: false,
      finishing: "",
    };
    onChange([...jobs, newJob]);
    setExpandedRows(new Set([...expandedRows, jobs.length]));
  };

  const handleDelete = (index: number) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      onChange(jobs.filter((_, i) => i !== index));
      const newExpanded = new Set<number>();
      expandedRows.forEach(i => {
        if (i < index) newExpanded.add(i);
        else if (i > index) newExpanded.add(i - 1);
      });
      setExpandedRows(newExpanded);
    }
  };

  const handleFieldChange = (index: number, field: keyof LocalDigitalJob, value: any) => {
    const updated = [...jobs];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate pieces_per_sheet when format or sheet format changes
    if ((field === 'finished_w_mm' || field === 'finished_h_mm' || field === 'machine_sheet_format') && !updated[index].pieces_per_sheet_override) {
      const autoNup = calculatePiecesPerSheet(
        updated[index].finished_w_mm,
        updated[index].finished_h_mm,
        updated[index].machine_sheet_format || '330x488'
      );
      updated[index].pieces_per_sheet = autoNup;
    }

    // Recompute immediately after field change
    if (settings && priceList && priceList.length > 0) {
      const result = computeDigitalJob(
        updated[index],
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
    const jobsWithDefaults = newJobs.map(job => ({
      ...job,
      paper_type: paperTypes?.[0]?.name || "",
      machine_sheet_format: "330x488",
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
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[180px]">Naziv</TableHead>
                <TableHead className="w-[100px]">Format (mm)</TableHead>
                <TableHead className="w-[70px]">Štampa</TableHead>
                <TableHead className="w-[80px]">Tiraž</TableHead>
                <TableHead className="w-[100px]">Papir</TableHead>
                <TableHead className="w-[90px]">Tabak</TableHead>
                <TableHead className="w-[60px] text-right">NUP</TableHead>
                <TableHead className="w-[80px] text-right">Tabaka</TableHead>
                <TableHead className="w-[70px] text-right">Color</TableHead>
                <TableHead className="w-[70px] text-right">Mono</TableHead>
                <TableHead className="w-[90px] text-right">Iznos (€)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job, index) => (
                <Fragment key={index}>
                  <TableRow className={expandedRows.has(index) ? "border-b-0" : ""}>
                    <TableCell className="py-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0"
                        onClick={() => toggleRowExpanded(index)}
                      >
                        {expandedRows.has(index) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={job.name || job.file_name || ''}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        placeholder="Naziv stavke"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          value={job.finished_w_mm || ''}
                          onChange={(e) => handleFieldChange(index, 'finished_w_mm', parseInt(e.target.value) || 0)}
                          placeholder="Š"
                          className="w-12 h-8 text-xs"
                        />
                        <span className="text-muted-foreground self-center">×</span>
                        <Input
                          type="number"
                          value={job.finished_h_mm || ''}
                          onChange={(e) => handleFieldChange(index, 'finished_h_mm', parseInt(e.target.value) || 0)}
                          placeholder="V"
                          className="w-12 h-8 text-xs"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Select
                        value={job.print_sides}
                        onValueChange={(v) => handleFieldChange(index, 'print_sides', v)}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
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
                        className="w-16 h-8"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Select
                        value={job.paper_type || ''}
                        onValueChange={(v) => handleFieldChange(index, 'paper_type', v)}
                      >
                        <SelectTrigger className="h-8 w-[100px]">
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
                        value={job.machine_sheet_format || '330x488'}
                        onValueChange={(v) => handleFieldChange(index, 'machine_sheet_format', v)}
                      >
                        <SelectTrigger className="h-8 w-[90px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHEET_FORMATS.map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2 text-right text-muted-foreground">
                      {job.pieces_per_sheet || job.computed_nup || '-'}
                    </TableCell>
                    <TableCell className="py-2 text-right text-muted-foreground">
                      {job.computed_total_sheets || '-'}
                      {(job.test_sheets || 0) > 0 && (
                        <span className="text-xs block">+{job.test_sheets} test</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right text-muted-foreground">
                      {job.computed_color_clicks || '-'}
                    </TableCell>
                    <TableCell className="py-2 text-right text-muted-foreground">
                      {job.computed_mono_clicks || '-'}
                    </TableCell>
                    <TableCell className="py-2 text-right font-medium">
                      {job.computed_line_total !== undefined ? `€${job.computed_line_total.toFixed(2)}` : '-'}
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
                  {expandedRows.has(index) && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={13} className="py-3 px-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Fajl</label>
                            <Input
                              value={job.file_name || ''}
                              onChange={(e) => handleFieldChange(index, 'file_name', e.target.value)}
                              placeholder="Naziv fajla"
                              className="h-8 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Strane</label>
                            <Input
                              type="number"
                              value={job.pages || ''}
                              onChange={(e) => handleFieldChange(index, 'pages', parseInt(e.target.value) || 1)}
                              min={1}
                              className="h-8 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">NUP (ručno)</label>
                            <Input
                              type="number"
                              value={job.pieces_per_sheet_override || ''}
                              onChange={(e) => handleFieldChange(index, 'pieces_per_sheet_override', parseInt(e.target.value) || null)}
                              placeholder={`Auto: ${calculatePiecesPerSheet(job.finished_w_mm, job.finished_h_mm, job.machine_sheet_format || '330x488')}`}
                              className="h-8 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Test tabaka</label>
                            <Input
                              type="number"
                              value={job.test_sheets || ''}
                              onChange={(e) => handleFieldChange(index, 'test_sheets', parseInt(e.target.value) || 0)}
                              min={0}
                              className="h-8 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Dorada</label>
                            <Select
                              value={job.finishing || ''}
                              onValueChange={(v) => handleFieldChange(index, 'finishing', v)}
                            >
                              <SelectTrigger className="h-8 mt-1">
                                <SelectValue placeholder="Izaberi" />
                              </SelectTrigger>
                              <SelectContent>
                                {FINISHING_OPTIONS.map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end gap-2 pb-1">
                            <Checkbox
                              id={`test-clicks-${index}`}
                              checked={job.include_test_in_clicks || false}
                              onCheckedChange={(checked) => handleFieldChange(index, 'include_test_in_clicks', checked)}
                            />
                            <label htmlFor={`test-clicks-${index}`} className="text-xs">
                              Test u klikove
                            </label>
                          </div>
                          <div className="flex items-end gap-2 pb-1">
                            <Checkbox
                              id={`test-print-${index}`}
                              checked={job.is_test_print || false}
                              onCheckedChange={(checked) => handleFieldChange(index, 'is_test_print', checked)}
                            />
                            <label htmlFor={`test-print-${index}`} className="text-xs">
                              Probna štampa (€0)
                            </label>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
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
