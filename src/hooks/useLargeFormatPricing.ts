import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

export interface MaterialPrice {
  id: string;
  material_id: string;
  supplier_price_per_m2: number;
  price_0_5_m2: number;
  price_5_10_m2: number;
  price_10_20_m2: number;
  price_20_50_m2: number;
  price_50_100_m2: number;
  price_100_200_m2: number;
  price_200_500_m2: number;
  price_500_plus_m2: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialWithPrice {
  id: string;
  name: string;
  category: string;
  usage_count: number;
  price?: MaterialPrice;
}

/** Reads from the GDC Order database (read-only). */
export function useLargeFormatMaterialsWithPrices() {
  return useQuery({
    queryKey: ["gdc-large-format-materials-with-prices"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: materials, error: matError } = await supabaseGDC
        .from("large_format_materials")
        .select("id, name, category, usage_count")
        .eq("is_active", true)
        .order("usage_count", { ascending: false });

      if (matError) throw matError;

      const { data: prices, error: priceError } = await supabaseGDC
        .from("large_format_material_prices")
        .select("*");

      if (priceError) throw priceError;

      const priceMap = new Map(
        ((prices as unknown as MaterialPrice[]) || []).map((p) => [p.material_id, p])
      );

      return (materials || []).map((mat: any) => ({
        ...mat,
        price: priceMap.get(mat.id),
      })) as MaterialWithPrice[];
    },
  });
}

export function getApplicablePrice(
  price: MaterialPrice | undefined,
  areaM2: number
): number {
  if (!price) return 0;
  if (areaM2 >= 500) return price.price_500_plus_m2;
  if (areaM2 >= 200) return price.price_200_500_m2;
  if (areaM2 >= 100) return price.price_100_200_m2;
  if (areaM2 >= 50) return price.price_50_100_m2;
  if (areaM2 >= 20) return price.price_20_50_m2;
  if (areaM2 >= 10) return price.price_10_20_m2;
  if (areaM2 >= 5) return price.price_5_10_m2;
  return price.price_0_5_m2;
}
