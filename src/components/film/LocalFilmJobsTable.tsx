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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  // Compute all jobs via edge function
  useEffect(() => {
    const computeAllJobs = async () => {
      if (jobs.length === 0) {
        setComputedJobs({});
        setValidationErrors({});
        return;
      }

      const errors: Record<number, { width?: string; height?: string; qty?: string }> = {};
      
      // Validate locally first
      jobs.forEach((job, index) => {
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
      });

      setValidationErrors(errors);

      // Prepare items for batch compute
      const itemsToCompute = jobs
        .map((job, index) => ({
          index,
          file_name: job.file_name || `Item ${index + 1}`,
          width_mm: job.width_mm || 0,
          height_mm: job.height_mm || 0,
          quantity: job.qty || 0,
        }))
        .filter((item) => item.width_mm > 0 && item.height_mm > 0 && item.quantity > 0);

      if (itemsToCompute.length === 0) {
        setComputedJobs({});
        return;
      }

      try {
        // Call edge function
        const { data, error } = await supabase.functions.invoke('compute-film-job', {
          body: {
            roll_width_mm: 500,
            smart_rotation: false,
            waste_percent: 0,
            items: itemsToCompute,
          },
        });

        if (error) {
          console.error('Error computing film jobs:', error);
          toast({
            title: "Greška",
            description: "Nije moguće izračunati potrošnju filma",
            variant: "destructive",
          });
          return;
        }

        // Map results back to indices
        const computed: Record<number, any> = {};
        if (data?.items) {
          itemsToCompute.forEach((item, i) => {
            const result = data.items[i];
            if (result && !result.error) {
              computed[item.index] = {
                computed_m_per_piece: result.m_per_piece,
                computed_total_m: result.total_m,
                computed_rotation_deg: result.rotation,
              };
            }
          });
        }

        setComputedJobs(computed);
      } catch (err) {
        console.error('Exception computing film jobs:', err);
        toast({
          title: "Greška",
          description: "Greška pri računanju potrošnje filma",
          variant: "destructive",
        });
      }
    };
    
    computeAllJobs();
  }, [jobs, toast]);

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
    const startIndex = jobs.length;
    onChange([...jobs, ...newJobs]);
    
    // Focus first width input of newly added jobs after a short delay
    setTimeout(() => {
      const firstNewInput = inputRefs.current[`${startIndex}-width`];
      if (firstNewInput) {
        firstNewInput.focus();
        firstNewInput.select();
      }
    }, 100);
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number,
    field: 'width_mm' | 'height_mm'
  ) => {
    const pastedText = e.clipboardData.getData('text').trim();
    // Match patterns like "745x605" or "745×605"
    const dimensionPattern = /^(\d+)[x×](\d+)$/i;
    const match = pastedText.match(dimensionPattern);
    
    if (match) {
      e.preventDefault();
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      
      // Clear any pending debounce timers
      if (debounceTimers.current[index]) {
        clearTimeout(debounceTimers.current[index]);
      }
      
      const newJobs = [...jobs];
      newJobs[index] = {
        ...newJobs[index],
        width_mm: width,
        height_mm: height,
      };
      onChange(newJobs);
      
      // Focus next field (quantity)
      setTimeout(() => {
        const qtyRef = inputRefs.current[`${index}-qty`];
        if (qtyRef) {
          qtyRef.focus();
          qtyRef.select();
        }
      }, 50);
    }
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
              <TableHead className="w-[100px]">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nema stavki. Dodajte stavku ili importujte fajlove.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job, index) => {
                const computed = computedJobs[index];
                const errors = validationErrors[index];
                
                return (
                  <TableRow key={index}>
                    <TableCell>{job.file_name}</TableCell>
                    <TableCell>
                      <Input
                        ref={(el) => (inputRefs.current[`${index}-width`] = el)}
                        type="number"
                        value={job.width_mm || ""}
                        onChange={(e) => handleFieldChange(index, "width_mm", parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, index, "width")}
                        onPaste={(e) => handlePaste(e, index, "width_mm")}
                        min={10}
                        max={500}
                        className={cn(
                          "w-24",
                          errors?.width && "border-red-500"
                        )}
                        placeholder="10-500"
                      />
                      {errors?.width && (
                        <p className="text-xs text-red-500 mt-1">{errors.width}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        ref={(el) => (inputRefs.current[`${index}-height`] = el)}
                        type="number"
                        value={job.height_mm || ""}
                        onChange={(e) => handleFieldChange(index, "height_mm", parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, index, "height")}
                        onPaste={(e) => handlePaste(e, index, "height_mm")}
                        min={10}
                        className={cn(
                          "w-24",
                          errors?.height && "border-red-500"
                        )}
                        placeholder="≥10"
                      />
                      {errors?.height && (
                        <p className="text-xs text-red-500 mt-1">{errors.height}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        ref={(el) => (inputRefs.current[`${index}-qty`] = el)}
                        type="number"
                        value={job.qty || ""}
                        onChange={(e) => handleFieldChange(index, "qty", parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, index, "qty")}
                        min={1}
                        step={1}
                        className={cn(
                          "w-20",
                          errors?.qty && "border-red-500"
                        )}
                        placeholder="≥1"
                      />
                      {errors?.qty && (
                        <p className="text-xs text-red-500 mt-1">{errors.qty}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {computed ? (
                        <span className="text-sm font-medium">
                          {computed.computed_m_per_piece.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {computed ? (
                        <span className="text-sm font-medium">
                          {computed.computed_total_m.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
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
                );
              })
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
              <span>{jobs.reduce((sum, job) => sum + (job.qty || 0), 0)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="font-medium">Ukupna dužina filma:</span>
              <span className="font-bold">
                {Object.values(computedJobs).reduce((sum: number, computed: any) => 
                  sum + (computed?.computed_total_m || 0), 0
                ).toFixed(2)} m
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
