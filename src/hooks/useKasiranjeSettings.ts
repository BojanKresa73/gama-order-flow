import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";
import {
  useLargeFormatMaterialsWithPrices,
  type MaterialWithPrice,
} from "@/hooks/useLargeFormatPricing";

export interface KasiranjeSettings {
  id: string;
  film_material_id: string | null;
  toner_cost_per_m2_eur: number;
}

export interface KasiranjeLaborService {
  id: string;
  name: string;
  pricing_type: string;
  price: number;
  start_price: number;
  start_threshold: number;
}

export interface ResolvedKasiranje {
  settings: KasiranjeSettings | null;
  film: MaterialWithPrice | null;
  tonerPerM2Eur: number;
  labor: KasiranjeLaborService | null;
}

function useKasiranjeSettingsRaw() {
  return useQuery({
    queryKey: ["gdc-kasiranje-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<KasiranjeSettings | null> => {
      const { data, error } = await supabaseGDC
        .from("kasiranje_settings")
        .select("id, film_material_id, toner_cost_per_m2_eur")
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

function useKasiranjeLaborService() {
  return useQuery({
    queryKey: ["gdc-kasiranje-labor-service"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<KasiranjeLaborService | null> => {
      const { data, error } = await supabaseGDC
        .from("price_list_services")
        .select("id, name, pricing_type, price, start_price, start_threshold, is_active")
        .eq("is_active", true)
        .ilike("name", "%kaširanje%");
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      return rows[0] ?? null;
    },
  });
}

export function useKasiranjeSettings(): { data: ResolvedKasiranje; isLoading: boolean } {
  const settingsQ = useKasiranjeSettingsRaw();
  const materialsQ = useLargeFormatMaterialsWithPrices();
  const laborQ = useKasiranjeLaborService();

  const settings = settingsQ.data ?? null;
  const film =
    settings?.film_material_id && materialsQ.data
      ? materialsQ.data.find((m) => m.id === settings.film_material_id) ?? null
      : null;

  return {
    data: {
      settings,
      film,
      tonerPerM2Eur: Number(settings?.toner_cost_per_m2_eur ?? 1.1),
      labor: laborQ.data ?? null,
    },
    isLoading: settingsQ.isLoading || materialsQ.isLoading || laborQ.isLoading,
  };
}
