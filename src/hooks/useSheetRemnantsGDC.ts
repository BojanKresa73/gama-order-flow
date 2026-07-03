import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/** Read-only mirror of GDC `sheet_remnants` (ostaci tabaka). */
export interface GdcSheetRemnant {
  id: string;
  paper_id?: string | null;
  name?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  sheets_available?: number | null;
  cost_per_sheet_eur?: number | null;
  is_active?: boolean | null;
  [k: string]: any;
}

export function useSheetRemnantsGDC() {
  return useQuery({
    queryKey: ["gdc-sheet-remnants"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GdcSheetRemnant[]> => {
      const { data, error } = await supabaseGDC
        .from("sheet_remnants")
        .select("*");
      if (error) {
        console.warn("[useSheetRemnantsGDC] not available:", error.message);
        return [];
      }
      return (data as any[]) ?? [];
    },
  });
}
