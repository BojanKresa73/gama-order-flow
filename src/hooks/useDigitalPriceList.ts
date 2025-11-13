import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PriceListEntry } from "@/lib/digitalCalculations";

export const useDigitalPriceList = () => {
  return useQuery({
    queryKey: ["digital-price-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_digital" as any)
        .select("*")
        .order("break_qty");

      if (error) throw error;
      return data as unknown as PriceListEntry[];
    },
  });
};
