import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fitOnRoll, FitResult } from "@/lib/filmCalculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFilmJobs, FilmJob } from "@/hooks/useFilmJobs";
import { z } from "zod";

const filmJobSchema = z.object({
  file_name: z.string().trim().min(1, "Naziv fajla je obavezan"),
  width_mm: z.number().min(10, "Širina mora biti najmanje 10mm"),
  height_mm: z.number().min(10, "Visina mora biti najmanje 10mm"),
  qty: z.number().min(1, "Količina mora biti najmanje 1"),
  allow_rotate_90: z.boolean(),
  margin_mm: z.number().min(0, "Margina ne može biti negativna"),
  note: z.string().optional(),
});

interface FilmJobsTableProps {
  workOrderId: string | undefined;
}

export const FilmJobsTable = ({ workOrderId }: FilmJobsTableProps) => {
  const { filmJobs, isLoading, createFilmJob, updateFilmJob, deleteFilmJob } =
    useFilmJobs(workOrderId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewCompute, setPreviewCompute] = useState<FitResult | null>(null);

  const [formData, setFormData] = useState<Partial<FilmJob>>({
    file_name: "",
    width_mm: 0,
    height_mm: 0,
    qty: 1,
    allow_rotate_90: true,
    margin_mm: 0,
    note: "",
  });

  // Real-time calculation preview
  useEffect(() => {
    const fetchAndCompute = async () => {
      if (formData.width_mm && formData.height_mm && formData.qty) {
        const { data: settings } = await supabase
          .from('film_settings')
          .select('*')
          .single();
        
        if (settings) {
          try {
            const result = fitOnRoll(
              formData.width_mm || 0,
              formData.height_mm || 0,
              formData.qty || 1,
              settings.roll_width_mm,
              settings.side_margin_mm,
              settings.gap_mm,
              settings.waste_percent
            );
            
            setPreviewCompute(result);
          } catch (error) {
            setPreviewCompute(null);
          }
        }
      }
    };
    
    fetchAndCompute();
  }, [formData.width_mm, formData.height_mm, formData.qty, formData.allow_rotate_90, formData.margin_mm]);

  const resetForm = () => {
    setFormData({
      file_name: "",
      width_mm: 0,
      height_mm: 0,
      qty: 1,
      allow_rotate_90: true,
      margin_mm: 0,
      note: "",
    });
    setErrors({});
    setIsAdding(false);
    setEditingId(null);
  };

  const validateForm = (): boolean => {
    try {
      filmJobSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSave = () => {
    if (!validateForm() || !workOrderId) return;

    if (editingId) {
      updateFilmJob({
        id: editingId,
        work_order_id: workOrderId,
        ...formData,
      } as FilmJob & { id: string });
    } else {
      createFilmJob({
        work_order_id: workOrderId,
        ...formData,
      } as FilmJob);
    }
    resetForm();
  };

  const handleEdit = (job: FilmJob) => {
    setFormData(job);
    setEditingId(job.id || null);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      deleteFilmJob(id);
    }
  };

  const renderFormRow = () => (
    <TableRow>
      <TableCell>
        <Input
          value={formData.file_name}
          onChange={(e) =>
            setFormData({ ...formData, file_name: e.target.value })
          }
          placeholder="Naziv fajla"
          className={errors.file_name ? "border-destructive" : ""}
        />
        {errors.file_name && (
          <span className="text-xs text-destructive">{errors.file_name}</span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={formData.width_mm || ""}
          onChange={(e) =>
            setFormData({ ...formData, width_mm: Number(e.target.value) })
          }
          placeholder="Širina"
          className={errors.width_mm ? "border-destructive" : ""}
        />
        {errors.width_mm && (
          <span className="text-xs text-destructive">{errors.width_mm}</span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={formData.height_mm || ""}
          onChange={(e) =>
            setFormData({ ...formData, height_mm: Number(e.target.value) })
          }
          placeholder="Visina"
          className={errors.height_mm ? "border-destructive" : ""}
        />
        {errors.height_mm && (
          <span className="text-xs text-destructive">{errors.height_mm}</span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={formData.qty || ""}
          onChange={(e) =>
            setFormData({ ...formData, qty: Number(e.target.value) })
          }
          placeholder="Količina"
          className={errors.qty ? "border-destructive" : ""}
        />
        {errors.qty && (
          <span className="text-xs text-destructive">{errors.qty}</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={formData.allow_rotate_90}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, allow_rotate_90: checked as boolean })
          }
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={formData.margin_mm || ""}
          onChange={(e) =>
            setFormData({ ...formData, margin_mm: Number(e.target.value) })
          }
          placeholder="0"
          className={errors.margin_mm ? "border-destructive" : ""}
        />
        {errors.margin_mm && (
          <span className="text-xs text-destructive">{errors.margin_mm}</span>
        )}
      </TableCell>
      <TableCell>
        {previewCompute ? `${previewCompute.orientation}°` : '-'}
      </TableCell>
      <TableCell>
        {previewCompute ? previewCompute.m_per_piece.toFixed(4) : '-'}
      </TableCell>
      <TableCell>
        {previewCompute ? previewCompute.total_m.toFixed(2) : '-'}
      </TableCell>
      <TableCell>
        <Textarea
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          placeholder="Napomena"
          rows={1}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={resetForm}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  if (!workOrderId) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Stavke filmovanja</h3>
        <Button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          disabled={isAdding || editingId !== null}
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj stavku
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv fajla</TableHead>
              <TableHead>Širina (mm)</TableHead>
              <TableHead>Visina (mm)</TableHead>
              <TableHead>Količina</TableHead>
              <TableHead className="text-center">Rotacija 90°</TableHead>
              <TableHead>Margina (mm)</TableHead>
              <TableHead>Orijentacija</TableHead>
              <TableHead>m/kom</TableHead>
              <TableHead>Ukupno m</TableHead>
              <TableHead>Napomena</TableHead>
              <TableHead>Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && renderFormRow()}
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : filmJobs.length === 0 && !isAdding ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  Nema stavki. Kliknite "Dodaj stavku" da dodate prvu.
                </TableCell>
              </TableRow>
            ) : (
              filmJobs.map((job) =>
                editingId === job.id ? (
                  renderFormRow()
                ) : (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.file_name}</TableCell>
                    <TableCell>{job.width_mm}</TableCell>
                    <TableCell>{job.height_mm}</TableCell>
                    <TableCell>{job.qty}</TableCell>
                    <TableCell className="text-center">
                      {job.allow_rotate_90 ? "✓" : "✗"}
                    </TableCell>
                    <TableCell>{job.margin_mm}</TableCell>
                    <TableCell>
                      {job.computed_rotation_deg !== null && job.computed_rotation_deg !== undefined
                        ? `${job.computed_rotation_deg}°`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {job.computed_m_per_piece !== null && job.computed_m_per_piece !== undefined
                        ? Number(job.computed_m_per_piece).toFixed(4)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {job.computed_total_m !== null && job.computed_total_m !== undefined
                        ? Number(job.computed_total_m).toFixed(2)
                        : "-"}
                    </TableCell>
                    <TableCell>{job.note || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(job)}
                          disabled={isAdding || editingId !== null}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(job.id!)}
                          disabled={isAdding || editingId !== null}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
