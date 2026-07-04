// Source of truth: GDC Order — src/hooks/useAiCorrections.ts (1:1 port)
// Bezbedno: ako tabela `ai_corrections` ne postoji, insert tiho preskače.

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CorrectionType = "tender_parse" | "extract_item";

interface LogCorrectionInput {
  type: CorrectionType;
  sourceText: string;
  aiOutput: unknown;
  correctedOutput: unknown;
  quoteId?: string | null;
  quoteItemId?: string | null;
}

export function useLogAiCorrection() {
  return useMutation({
    mutationFn: async (input: LogCorrectionInput) => {
      const { changed, hasChanges } = diffOutputs(input.aiOutput, input.correctedOutput);
      if (!hasChanges) return { skipped: true };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { skipped: true };

      const { error } = await supabase.from("ai_corrections" as any).insert({
        correction_type: input.type,
        source_text: (input.sourceText || "").slice(0, 8000),
        ai_output: input.aiOutput as any,
        corrected_output: input.correctedOutput as any,
        changed_fields: changed,
        quote_id: input.quoteId ?? null,
        quote_item_id: input.quoteItemId ?? null,
        created_by: user.id,
      });
      if (error) {
        console.warn("ai_correction insert failed", error);
        return { skipped: true };
      }
      return { skipped: false, changed };
    },
  });
}

function diffOutputs(a: unknown, b: unknown): { changed: string[]; hasChanges: boolean } {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return { changed: [], hasChanges: false };
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  const changed: string[] = [];
  for (const k of keys) {
    const va = normalize(ao[k]);
    const vb = normalize(bo[k]);
    if (va !== vb) changed.push(k);
  }
  return { changed, hasChanges: changed.length > 0 };
}

function normalize(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim().toLowerCase();
  if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
  return JSON.stringify(v);
}
