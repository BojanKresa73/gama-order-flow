import React, { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface FilmRow {
  id: string;
  file_name: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  computed_m_per_piece?: number;
  computed_total_m?: number;
  computed_rotation_deg?: number;
  across_count?: number;
  rows_needed?: number;
}

interface Props {
  row: FilmRow;
  index: number;
  onCommit: (id: string, patch: Partial<FilmRow>) => void;
  onDelete: (id: string) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

export default React.memo(function FilmItemRow({ row, index, onCommit, onDelete, inputRefs }: Props) {
  const [localW, setLocalW] = useState(String(row.width_mm || ""));
  const [localH, setLocalH] = useState(String(row.height_mm || ""));
  const [localQ, setLocalQ] = useState(String(row.quantity || "1"));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tRef = useRef<number | null>(null);
  const computeRef = useRef<number | null>(null);

  // Helper – only digits
  const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");

  // Debounced commit (400ms)
  const debouncedCommit = (patch: Partial<FilmRow>) => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      onCommit(row.id, patch);
    }, 400);
  };

  // Server compute for single item
  const callComputeFilmJob = async (w: number, h: number, q: number) => {
    if (w <= 0 || h <= 0 || q <= 0) return;

    // Validate locally first
    if (w > 500) {
      setError("Preširoko za rolu (max 500 mm)");
      return;
    }
    if (w < 10) {
      setError("Minimalna širina je 10 mm");
      return;
    }
    if (h < 10) {
      setError("Minimalna visina je 10 mm");
      return;
    }

    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('compute-film-job', {
        body: {
          roll_width_mm: 500,
          margin_mm: 0,
          gap_mm: 0,
          waste_percent: 0,
          items: [{
            file_name: row.file_name,
            width_mm: w,
            height_mm: h,
            quantity: q,
          }],
        },
      });

      if (invokeError) {
        console.error('Error computing film job:', invokeError);
        setError("Greška pri računanju");
        return;
      }

      if (data?.items?.[0] && !data.items[0].error) {
        const result = data.items[0];
        onCommit(row.id, {
          width_mm: w,
          height_mm: h,
          quantity: q,
          computed_m_per_piece: result.m_per_piece,
          computed_total_m: result.total_m,
          computed_rotation_deg: result.rotation,
          across_count: result.across,
          rows_needed: result.rows,
        });
      }
    } catch (err) {
      console.error('Exception computing film job:', err);
      setError("Greška pri računanju");
    }
  };

  // onChange handlers
  const onChangeW = (v: string) => setLocalW(onlyDigits(v));
  const onChangeH = (v: string) => setLocalH(onlyDigits(v));
  const onChangeQ = (v: string) => setLocalQ(onlyDigits(v));

  // onBlur – hard commit + trigger server compute
  const commitAll = () => {
    const w = Number(localW || 0);
    const h = Number(localH || 0);
    const q = Math.max(1, Number(localQ || 1));

    onCommit(row.id, { width_mm: w, height_mm: h, quantity: q });

    // Trigger compute in transition
    if (computeRef.current) clearTimeout(computeRef.current);
    computeRef.current = window.setTimeout(() => {
      startTransition(() => {
        callComputeFilmJob(w, h, q);
      });
    }, 100);
  };

  // Silent debounce commit during typing (without server calc)
  useEffect(() => {
    const w = Number(localW || 0);
    const h = Number(localH || 0);
    const q = Math.max(1, Number(localQ || 1));
    
    debouncedCommit({ width_mm: w, height_mm: h, quantity: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localW, localH, localQ]);

  // Sync local state when row changes externally
  useEffect(() => {
    setLocalW(String(row.width_mm || ""));
    setLocalH(String(row.height_mm || ""));
    setLocalQ(String(row.quantity || "1"));
  }, [row.width_mm, row.height_mm, row.quantity]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: 'width' | 'height' | 'qty') => {
    const fieldOrder = ['width', 'height', 'qty'];
    const currentFieldIndex = fieldOrder.indexOf(field);

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitAll();
      
      // Move to next field or next row
      if (currentFieldIndex < fieldOrder.length - 1) {
        const nextField = fieldOrder[currentFieldIndex + 1];
        const nextRef = inputRefs.current[`${index}-${nextField}`];
        nextRef?.focus();
        nextRef?.select();
      } else {
        const nextRef = inputRefs.current[`${index + 1}-width`];
        if (nextRef) {
          nextRef.focus();
          nextRef.select();
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRef = inputRefs.current[`${index + 1}-${field}`];
      if (nextRef) {
        nextRef.focus();
        nextRef.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRef = inputRefs.current[`${index - 1}-${field}`];
      if (prevRef) {
        prevRef.focus();
        prevRef.select();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, field: 'width_mm' | 'height_mm') => {
    const pastedText = e.clipboardData.getData('text').trim();
    const dimensionPattern = /^(\d+)[x×](\d+)$/i;
    const match = pastedText.match(dimensionPattern);
    
    if (match) {
      e.preventDefault();
      const width = match[1];
      const height = match[2];
      
      setLocalW(width);
      setLocalH(height);
      
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
    <>
      <td className="p-2">{row.file_name}</td>
      <td className="p-2">
        <Input
          ref={(el) => (inputRefs.current[`${index}-width`] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          value={localW}
          onChange={(e) => onChangeW(e.target.value)}
          onBlur={commitAll}
          onKeyDown={(e) => handleKeyDown(e, "width")}
          onPaste={(e) => handlePaste(e, "width_mm")}
          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
          min={10}
          max={500}
          className={cn(
            "w-24",
            error && error.includes("širina") && "border-destructive"
          )}
          placeholder="10-500"
        />
        {error && error.includes("širina") && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </td>
      <td className="p-2">
        <Input
          ref={(el) => (inputRefs.current[`${index}-height`] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          value={localH}
          onChange={(e) => onChangeH(e.target.value)}
          onBlur={commitAll}
          onKeyDown={(e) => handleKeyDown(e, "height")}
          onPaste={(e) => handlePaste(e, "height_mm")}
          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
          min={10}
          className={cn(
            "w-24",
            error && error.includes("visina") && "border-destructive"
          )}
          placeholder="≥10"
        />
        {error && error.includes("visina") && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </td>
      <td className="p-2">
        <Input
          ref={(el) => (inputRefs.current[`${index}-qty`] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          value={localQ}
          onChange={(e) => onChangeQ(e.target.value)}
          onBlur={commitAll}
          onKeyDown={(e) => handleKeyDown(e, "qty")}
          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
          min={1}
          step={1}
          className="w-20"
          placeholder="≥1"
        />
      </td>
      <td className="p-2">
        {row.across_count ? (
          <span className="text-sm font-medium">{row.across_count}</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-2">
        {row.computed_rotation_deg !== undefined ? (
          <span className="text-sm font-medium">{row.computed_rotation_deg}°</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-2">
        {isPending ? (
          <span className="text-xs text-muted-foreground">računam…</span>
        ) : row.computed_m_per_piece ? (
          <span className="text-sm font-medium">
            {row.computed_m_per_piece.toFixed(4)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-2">
        {row.computed_total_m ? (
          <span className="text-sm font-medium">
            {row.computed_total_m.toFixed(2)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(row.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </>
  );
});
