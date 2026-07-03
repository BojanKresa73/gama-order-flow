import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/** Read-only mirror of GDC `suppliers`. */
export interface GdcSupplier {
  id: string;
  name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean | null;
  [k: string]: any;
}

export function useSuppliersGDC() {
  return useQuery({
    queryKey: ["gdc-suppliers"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<GdcSupplier[]> => {
      const { data, error } = await supabaseGDC
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        console.warn("[useSuppliersGDC] not available:", error.message);
        return [];
      }
      return (data as any[]) ?? [];
    },
  });
}
