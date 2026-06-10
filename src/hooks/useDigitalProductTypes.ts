import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DigitalProductType {
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  display_order: number;
  default_paper: string | null;
  default_print_sides: string | null;
  default_machine_sheet_format: string | null;
  supports_cover: boolean;
  supports_pages: boolean;
}

export const useDigitalProductTypes = () => {
  return useQuery({
    queryKey: ["digital-product-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_product_types" as any)
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as DigitalProductType[];
    },
  });
};
