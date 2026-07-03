import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/**
 * Read-only mirror of GDC Order `price_list_services` (dorada, montaža,
 * kaširanje, itd.). Used by Quotes-Pro to price line-item finishing / services.
 */
export interface GdcService {
  id: string;
  name: string;
  category: string | null;
  pricing_type: string; // "per_m2" | "per_piece" | "fixed" | "tiered" | "per_m"
  price: number;
  start_price: number | null;
  start_threshold: number | null;
  unit: string | null;
  is_active: boolean;
  display_order: number | null;
}

export function useServicesGDC(category?: string) {
  return useQuery({
    queryKey: ["gdc-price-list-services", category ?? "all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GdcService[]> => {
      let q = supabaseGDC
        .from("price_list_services")
        .select(
          "id, name, category, pricing_type, price, start_price, start_threshold, unit, is_active, display_order"
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as any[]) ?? []) as GdcService[];
    },
  });
}

/** Price a service for a given quantity/area, honouring tiered start_price. */
export function priceGdcService(
  svc: Pick<GdcService, "pricing_type" | "price" | "start_price" | "start_threshold">,
  qty: number
): number {
  if (!svc) return 0;
  const start = Number(svc.start_price ?? 0);
  const threshold = Number(svc.start_threshold ?? 0);
  const unit = Number(svc.price ?? 0);
  if (svc.pricing_type === "fixed") return unit;
  if (svc.pricing_type === "tiered" && start > 0 && threshold > 0) {
    if (qty <= threshold) return start;
    return start + (qty - threshold) * unit;
  }
  return unit * qty;
}
