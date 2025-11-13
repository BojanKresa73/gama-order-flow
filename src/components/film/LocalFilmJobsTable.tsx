import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, X, Check } from "lucide-react";
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
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { computeFilmJobClient } from "@/lib/filmCalculations";

const filmJobSchema = z.object({
  file_name: z.string().trim().min(1, "Naziv fajla je obavezan"),
  width_mm: z.number().min(10, "Širina mora biti najmanje 10mm"),
  height_mm: z.number().min(10, "Visina mora biti najmanje 10mm"),
  qty: z.number().min(1, "Količina mora biti najmanje 1"),
  allow_rotate_90: z.boolean(),
  margin_mm: z.number().min(0, "Margina ne može biti negativna"),
  note: z.string().optional(),
});

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
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewCompute, setPreviewCompute] = useState<any>(null);
  const [computedJobs, setComputedJobs] = useState<Record<number, any>>({});

  const [formData, setFormData] = useState<LocalFilmJob>({
    file_name: "",
    width_mm: 0,
    height_mm: 0,
    qty: 1,
    allow_rotate_90: true, // Always true, hidden from user
    margin_mm: 0, // Always 0, hidden from user
    note: "",
  });

  // Compute existing jobs
  useEffect(() => {
    const computeAllJobs = async () => {
      const { data: settings } = await supabase
        .from('film_settings')
        .select('*')
        .single();
      
      if (settings) {
        const computed: Record<number, any> = {};
        jobs.forEach((job, index) => {
          if (job.width_mm && job.height_mm && job.qty) {
            const result = computeFilmJobClient(job, settings);
            if (!('error' in result)) {
              computed[index] = result;
            }
          }
        });
        setComputedJobs(computed);
      }
    };
    
    computeAllJobs();
  }, [jobs]);

  // Real-time calculation preview for form
  useEffect(() => {
    const fetchAndCompute = async () => {
      if (formData.width_mm && formData.height_mm && formData.qty) {
        const { data: settings } = await supabase
          .from('film_settings')
          .select('*')
          .single();
        
        if (settings) {
          const result = computeFilmJobClient({
            width_mm: formData.width_mm || 0,
            height_mm: formData.height_mm || 0,
            qty: formData.qty || 1,
            allow_rotate_90: formData.allow_rotate_90 ?? true,
            margin_mm: formData.margin_mm || 0,
          }, settings);
          
          setPreviewCompute('error' in result ? null : result);
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
      allow_rotate_90: true, // Always true, hidden
      margin_mm: 0, // Always 0, hidden
      note: "",
    });
    setErrors({});
    setIsAdding(false);
    setEditingIndex(null);
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
    if (!validateForm()) return;

    if (editingIndex !== null) {
      const updated = [...jobs];
      updated[editingIndex] = formData;
      onChange(updated);
    } else {
      onChange([...jobs, formData]);
    }
    resetForm();
  };

  const handleEdit = (index: number) => {
    setFormData(jobs[index]);
    setEditingIndex(index);
    setIsAdding(false);
  };

  const handleDelete = (index: number) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      onChange(jobs.filter((_, i) => i !== index));
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
      <TableCell>
        {previewCompute ? `${previewCompute.computed_rotation_deg}°` : '-'}
      </TableCell>
      <TableCell>
        {previewCompute ? previewCompute.computed_m_per_piece.toFixed(4) : '-'}
      </TableCell>
      <TableCell>
        {previewCompute ? previewCompute.computed_total_m.toFixed(2) : '-'}
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
          <Button size="sm" type="button" onClick={handleSave}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" type="button" variant="outline" onClick={resetForm}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Stavke filmovanja</h3>
        <Button
          type="button"
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          disabled={isAdding || editingIndex !== null}
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
              <TableHead>Orijentacija</TableHead>
              <TableHead>m/kom</TableHead>
              <TableHead>Ukupno m</TableHead>
              <TableHead>Napomena</TableHead>
              <TableHead>Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && renderFormRow()}
            {jobs.length === 0 && !isAdding ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nema stavki. Kliknite "Dodaj stavku" da dodate prvu.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job, index) =>
                editingIndex === index ? (
                  renderFormRow()
                ) : (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{job.file_name}</TableCell>
                    <TableCell>{job.width_mm}</TableCell>
                    <TableCell>{job.height_mm}</TableCell>
                    <TableCell>{job.qty}</TableCell>
                    <TableCell>
                      {computedJobs[index] ? `${computedJobs[index].computed_rotation_deg}°` : '-'}
                    </TableCell>
                    <TableCell>
                      {computedJobs[index] ? computedJobs[index].computed_m_per_piece.toFixed(4) : '-'}
                    </TableCell>
                    <TableCell>
                      {computedJobs[index] ? computedJobs[index].computed_total_m.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell>{job.note || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(index)}
                          disabled={isAdding || editingIndex !== null}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(index)}
                          disabled={isAdding || editingIndex !== null}
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
