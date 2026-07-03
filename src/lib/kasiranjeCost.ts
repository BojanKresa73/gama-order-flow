import type { MaterialWithPrice } from "@/hooks/useLargeFormatPricing";
import type { KasiranjeLaborService } from "@/hooks/useKasiranjeSettings";

export interface KasiranjeBreakdown {
  areaM2: number;
  filmPricePerM2Eur: number;
  tonerPerM2Eur: number;
  filmCostEur: number;
  tonerCostEur: number;
  laborCostEur: number;
  laborPerM2Eur: number;
  laborStartEur: number;
  laborName: string;
  totalEur: number;
  filmName: string;
  hasFilm: boolean;
  hasLabor: boolean;
}

export function computeKasiranjeCostEur(input: {
  areaM2: number;
  film: MaterialWithPrice | null;
  tonerPerM2Eur: number;
  labor?: KasiranjeLaborService | null;
}): KasiranjeBreakdown {
  const areaM2 = Math.max(0, Number(input.areaM2 || 0));
  const tonerPerM2Eur = Math.max(0, Number(input.tonerPerM2Eur || 0));
  const filmPricePerM2Eur = Math.max(0, Number(input.film?.price?.supplier_price_per_m2 ?? 0));
  const filmCostEur = filmPricePerM2Eur * areaM2;
  const tonerCostEur = tonerPerM2Eur * areaM2;

  const labor = input.labor ?? null;
  const laborPerM2Eur = Math.max(0, Number(labor?.price ?? 0));
  const laborStartEur = Math.max(0, Number(labor?.start_price ?? 0));
  const laborLinear = laborPerM2Eur * areaM2;
  const laborCostEur = labor && areaM2 > 0 ? Math.max(laborStartEur, laborLinear) : 0;

  return {
    areaM2,
    filmPricePerM2Eur,
    tonerPerM2Eur,
    filmCostEur,
    tonerCostEur,
    laborCostEur,
    laborPerM2Eur,
    laborStartEur,
    laborName: labor?.name ?? "Kaširanje (usluga)",
    totalEur: filmCostEur + tonerCostEur + laborCostEur,
    filmName: input.film?.name ?? "PVC folija (nije podešena)",
    hasFilm: !!input.film,
    hasLabor: !!labor,
  };
}
