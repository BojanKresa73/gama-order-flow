import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/** Read-only mirror of GDC `papers` catalog (arak formats and gsm-based cost). */
export interface GdcPaper {
  id: string;
  name: string;
  gsm: number | null;
  sheet_format: string | null;
  width_mm: number | null;
  height_mm: number | null;
  cost_per_sheet_eur: number | null;
  is_active: boolean;
}

export function usePapersGDC() {
  return useQuery({
    queryKey: ["gdc-papers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GdcPaper[]> => {
      const { data, error } = await supabaseGDC
        .from("papers")
        .select("id, name, gsm, sheet_format, width_mm, height_mm, cost_per_sheet_eur, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) {
        // Missing table on GDC side — fail soft.
        console.warn("[usePapersGDC] not available:", error.message);
        return [];
      }
      return ((data as any[]) ?? []) as GdcPaper[];
    },
  });
}
