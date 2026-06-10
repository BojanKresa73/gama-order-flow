import { useState, useMemo } from "react";
import { Plus, Trash2, FileUp, Package, Pencil, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddDigitalJobsModal } from "./AddDigitalJobsModal";
import { AddExternalServiceDialog, ExternalServicePayload } from "./AddExternalServiceDialog";
import { DigitalJobsSummary } from "./DigitalJobsSummary";
import { DigitalProductDialog } from "./DigitalProductDialog";
import { reconstructDraftFromJob, type ProductDraft } from "@/lib/digitalProductPricing";
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
import { calculateGroupedPricing } from "@/lib/digitalGroupedPricing";
import { useAuthz } from "@/hooks/useAuthz";

/** Extract pieces count from name (e.g., "flajer 27 kom" → 27) */
function extractPiecesFromName(name: string): number | null {
  const match = name.match(/(\d+)\s*kom\b/i);
  return match ? parseInt(match[1], 10) : null;
}

export interface LocalDigitalJob {
  id?: string; // UUID from database for existing items
  __status?: 'unchanged' | 'created' | 'updated' | 'deleted'; // Tracking status for diff
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
  pieces_count?: number | null; // Number of pieces (flyers, cards) imposed per copy
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
  // Product-oriented fields (set by DigitalProductForm)
  product_code?: string;
  page_count?: number;
  page_format?: string;
  page_width_mm?: number;
  page_height_mm?: number;
  has_cover?: boolean;
  cover_paper?: string;
  cover_print_sides?: string;
  cover_lamination?: string;
  binding_code?: string;
  product_group_id?: string;
  finishings?: Array<{
    code: string;
    name?: string;
    variant: string;
    pricing_model?: string;
    qty: number;
    unit_price: number;
    fixed_cost: number;
    total: number;
    notes?: string;
  }>;
  finishings_total?: number;
  // External service line (3rd-party, pass-through price)
  is_external_service?: boolean;
  external_price?: number;
  external_note?: string;
}

interface LocalDigitalJobsTableProps {
  jobs: LocalDigitalJob[];
  onChange: (jobs: LocalDigitalJob[]) => void;
  printSides: string;
  clientRabatProcenat?: number;
  prepHours?: number;
}

export const LocalDigitalJobsTable = ({ jobs, onChange, printSides, clientRabatProcenat, prepHours = 0 }: LocalDigitalJobsTableProps) => {
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showExternalDialog, setShowExternalDialog] = useState(false);
  const [editExternalIndex, setEditExternalIndex] = useState<number | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft | null>(null);
  const { data: paperTypes } = useDigitalPaperTypes();
  const { isSuper, isAdmin } = useAuthz();
  const canSeePrices = isSuper || isAdmin;

  // Calculate per-item price using grouped pricing logic
  const pricePerPieceMap = useMemo(() => {
    const pricing = calculateGroupedPricing(jobs, prepHours);
    const map = new Map<number, number>(); // index -> price per piece
    
    // Build a lookup: group key -> pricePerSheet (with format multiplier)
    const groupPriceMap = new Map<string, number>();
    for (const group of pricing.groups) {
      const key = `${group.coverage}|${group.format}`;
      groupPriceMap.set(key, group.pricePerSheetBase * group.formatMultiplier);
    }
    
    jobs.forEach((job, index) => {
      if (job.is_test_print) return;
      const coverage = job.print_sides || '4/4';
      const format = job.machine_sheet_format || '488x330';
      const key = `${coverage}|${format}`;
      const pricePerSheet = groupPriceMap.get(key) || 0;
      const obim = job.obim || 1;
      const qty = job.qty || 1;
      const totalSheets = obim * qty;
      const totalPrice = totalSheets * pricePerSheet;
      // Total pieces: explicit pieces_count > parsed from name > default to qty
      let totalPieces = qty;
      if (job.pieces_count && job.pieces_count > 0) {
        totalPieces = job.pieces_count;
      } else {
        const parsed = extractPiecesFromName(job.name || job.file_name || '');
        if (parsed && parsed > 0) totalPieces = parsed;
      }
      map.set(index, totalPieces > 0 ? totalPrice / totalPieces : 0);
    });
    
    return map;
  }, [jobs, prepHours]);

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
    const job = updated[index];
    const newStatus = job.id ? 'updated' : job.__status;
    const patch: Partial<LocalDigitalJob> = { [field]: value, __status: newStatus };
    
    // Auto-fill pieces_count when name changes and pieces_count isn't manually set
    if (field === 'name' && typeof value === 'string') {
      const parsed = extractPiecesFromName(value);
      if (parsed && parsed > 0) {
        patch.pieces_count = parsed;
      }
    }
    
    updated[index] = { ...job, ...patch };
    onChange(updated);
  };

  const handleAddJobs = (newJobs: LocalDigitalJob[]) => {
    const jobsWithDefaults = newJobs.map(job => {
      const name = job.name || job.file_name || '';
      const parsedPieces = extractPiecesFromName(name);
      return {
        ...job,
        obim: job.obim || 1,
        paper_type: paperTypes?.[0]?.name || "",
        machine_sheet_format: "488x330",
        pieces_count: parsedPieces || job.pieces_count || null,
        test_sheets: 0,
        include_test_in_clicks: false,
      };
    });
    onChange([...jobs, ...jobsWithDefaults]);
  };

  const handleEditProduct = (job: LocalDigitalJob) => {
    if (!job.product_group_id) return;
    // Find the "interior" job in the group — the one with finishings stashed,
    // falling back to the first member.
    const groupJobs = jobs.filter((j) => j.product_group_id === job.product_group_id);
    const interior = groupJobs.find((j) => (j.finishings?.length ?? 0) > 0) || groupJobs[0];
    setEditDraft(reconstructDraftFromJob(interior));
    setEditGroupId(job.product_group_id);
    setShowProductDialog(true);
  };

  const handleProductSubmit = (newJobs: LocalDigitalJob[], groupId?: string) => {
    if (groupId) {
      // Edit: replace all jobs sharing this group_id, preserving deleted ids for diff.
      const oldGroup = jobs.filter((j) => j.product_group_id === groupId);
      const oldIds = oldGroup.map((j) => j.id).filter(Boolean) as string[];
      // Carry the first existing id (and __status='updated') onto the new interior
      // so the row updates in place instead of being recreated.
      if (oldIds[0] && newJobs[0]) {
        newJobs[0] = { ...newJobs[0], id: oldIds[0], __status: 'updated' };
      }
      if (oldIds[1] && newJobs[1]) {
        newJobs[1] = { ...newJobs[1], id: oldIds[1], __status: 'updated' };
      }
      // Mark any leftover old ids as deleted (e.g., cover removed during edit).
      const carriedIds = new Set(newJobs.map((j) => j.id).filter(Boolean) as string[]);
      const deletedTombstones: LocalDigitalJob[] = oldGroup
        .filter((j) => j.id && !carriedIds.has(j.id))
        .map((j) => ({ ...j, __status: 'deleted' as const }));

      const others = jobs.filter((j) => j.product_group_id !== groupId);
      onChange([...others, ...newJobs, ...deletedTombstones]);
    } else {
      onChange([...jobs, ...newJobs]);
    }
    setEditGroupId(null);
    setEditDraft(null);
  };


  return (
    <div className="space-y-4">
      <DigitalJobsSummary jobs={jobs} clientRabatProcenat={clientRabatProcenat} prepHours={prepHours} />
      
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          onClick={() => setShowProductDialog(true)}
          size="sm"
        >
          <Package className="h-4 w-4 mr-2" />
          Dodaj proizvod
        </Button>
        <Button
          type="button"
          onClick={handleAdd}
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Brzi unos
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
                <TableHead className="w-[70px]">Obim</TableHead>
                <TableHead className="w-[80px]">Štampa</TableHead>
                <TableHead className="w-[70px]">Tabaka</TableHead>
                <TableHead className="w-[70px]">Komada</TableHead>
                <TableHead className="w-[130px]">Papir</TableHead>
                <TableHead className="w-[110px]">Format</TableHead>
                {canSeePrices && <TableHead className="w-[80px]">€/kom</TableHead>}
                <TableHead className="w-[40px]"></TableHead>
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
                      placeholder="Tiraž"
                      className="w-16 h-8"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      value={job.pieces_count || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleFieldChange(index, 'pieces_count', val ? parseInt(val) : null);
                      }}
                      min={1}
                      placeholder="—"
                      className="w-16 h-8"
                      title="Broj komada (flajera, kartica) po kopiji"
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
                  {canSeePrices && (
                    <TableCell className="py-2 text-right text-sm font-medium text-muted-foreground">
                      {job.is_test_print ? '—' : `€${(pricePerPieceMap.get(index) || 0).toFixed(3)}`}
                    </TableCell>
                  )}
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1">
                      {job.product_code && job.product_group_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleEditProduct(job)}
                          title="Izmeni proizvod"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleDelete(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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

      <DigitalProductDialog
        open={showProductDialog}
        onOpenChange={(o) => {
          setShowProductDialog(o);
          if (!o) {
            setEditGroupId(null);
            setEditDraft(null);
          }
        }}
        onAdd={handleProductSubmit}
        initialDraft={editDraft}
        editGroupId={editGroupId}
      />
    </div>
  );
};
