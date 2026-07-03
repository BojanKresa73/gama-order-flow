import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/** Read-only mirror of GDC `lf_finishing_prices` (dorada za velike formate). */
export interface GdcLfFinishingPrice {
  id: string;
  code?: string | null;
  name?: string | null;
  pricing_type?: string | null;
  price?: number | null;
  start_price?: number | null;
  start_threshold?: number | null;
  unit?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  [k: string]: any;
}

export function useFinishingPricesGDC() {
  return useQuery({
    queryKey: ["gdc-lf-finishing-prices"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GdcLfFinishingPrice[]> => {
      const { data, error } = await supabaseGDC
        .from("lf_finishing_prices")
        .select("*")
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) {
        console.warn("[useFinishingPricesGDC] not available:", error.message);
        return [];
      }
      return (data as any[]) ?? [];
    },
  });
}
