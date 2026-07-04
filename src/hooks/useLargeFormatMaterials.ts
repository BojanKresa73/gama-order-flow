// Wrapper koji čita listu materijala iz GDC (read-only). Ekvivalent GDC hook-a
// `useLargeFormatMaterials`, potrebno za `ImportTenderDialog`.

import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

export interface LargeFormatMaterial {
  id: string;
  name: string;
  category: string;
  usage_count?: number;
}

export function useLargeFormatMaterials() {
  return useQuery({
    queryKey: ["gdc-large-format-materials"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LargeFormatMaterial[]> => {
      const { data, error } = await supabaseGDC
        .from("large_format_materials")
        .select("id, name, category, usage_count")
        .eq("is_active", true)
        .order("usage_count", { ascending: false });
      if (error) {
        console.warn("[useLargeFormatMaterials] not available:", error.message);
        return [];
      }
      return ((data as any[]) ?? []) as LargeFormatMaterial[];
    },
  });
}
