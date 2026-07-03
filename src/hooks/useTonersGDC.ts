import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/** Read-only mirror of GDC `toner_types`. */
export interface GdcToner {
  id: string;
  name: string;
  color?: string | null;
  cost_per_ml_eur?: number | null;
  cost_per_m2_eur?: number | null;
  is_active?: boolean | null;
  [k: string]: any;
}

export function useTonersGDC() {
  return useQuery({
    queryKey: ["gdc-toner-types"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GdcToner[]> => {
      const { data, error } = await supabaseGDC
        .from("toner_types")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        console.warn("[useTonersGDC] not available:", error.message);
        return [];
      }
      return (data as any[]) ?? [];
    },
  });
}
