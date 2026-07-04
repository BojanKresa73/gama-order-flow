// Source of truth: GDC Order — src/lib/materialPriceFallback.ts (1:1 port)

import type { MaterialWithPrice } from "@/hooks/useLargeFormatPricing";

export function resolveMaterialEurPerM2(
  material: MaterialWithPrice | undefined | null,
  catalog: MaterialWithPrice[] | undefined | null
): { eurPerM2: number; isEstimated: boolean } {
  const direct = Number(material?.price?.supplier_price_per_m2 || 0);
  if (direct > 0) return { eurPerM2: direct, isEstimated: false };

  const all = catalog || [];
  const sameCat = material?.category
    ? all.filter((m) => m.category === material.category && (m.price?.supplier_price_per_m2 || 0) > 0)
    : [];
  if (sameCat.length) {
    const avg =
      sameCat.reduce((s, m) => s + Number(m.price!.supplier_price_per_m2), 0) / sameCat.length;
    return { eurPerM2: avg, isEstimated: true };
  }

  const withPrice = all.filter((m) => (m.price?.supplier_price_per_m2 || 0) > 0);
  if (withPrice.length) {
    const avg =
      withPrice.reduce((s, m) => s + Number(m.price!.supplier_price_per_m2), 0) /
      withPrice.length;
    return { eurPerM2: avg, isEstimated: true };
  }

  return { eurPerM2: 0, isEstimated: false };
}
