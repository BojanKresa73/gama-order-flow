import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DigitalFinishingType {
  code: string;
  name: string;
  category: string;
  pricing_model:
    | "per_copy"
    | "per_item"
    | "per_sheet"
    | "per_m2"
    | "fixed"
    | "fixed_plus_per_copy";
  has_variants: boolean;
  active: boolean;
  display_order: number;
  description: string | null;
}

export interface DigitalFinishingPrice {
  id: string;
  finishing_code: string;
  variant: string;
  fixed_cost: number;
  unit_price: number;
  min_qty: number;
  max_qty: number | null;
  notes: string | null;
  active: boolean;
  display_order: number;
}

export const useDigitalFinishingTypes = () => {
  return useQuery({
    queryKey: ["digital-finishing-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_finishing_types" as any)
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as DigitalFinishingType[];
    },
  });
};

export const useDigitalFinishingPrices = () => {
  return useQuery({
    queryKey: ["digital-finishing-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_finishing_prices" as any)
        .select("*")
        .eq("active", true)
        .order("finishing_code")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as DigitalFinishingPrice[];
    },
  });
};
