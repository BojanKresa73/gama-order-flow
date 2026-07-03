import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/** Read-only mirror of GDC `printing_machines`. */
export interface GdcPrintingMachine {
  id: string;
  name: string;
  kind?: string | null;
  max_width_mm?: number | null;
  max_height_mm?: number | null;
  cost_per_hour_eur?: number | null;
  is_active?: boolean | null;
  [k: string]: any;
}

export function usePrintingMachinesGDC() {
  return useQuery({
    queryKey: ["gdc-printing-machines"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GdcPrintingMachine[]> => {
      const { data, error } = await supabaseGDC
        .from("printing_machines")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        console.warn("[usePrintingMachinesGDC] not available:", error.message);
        return [];
      }
      return (data as any[]) ?? [];
    },
  });
}
