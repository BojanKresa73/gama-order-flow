// Copied verbatim from GDC Order — pricing formulas used by QuickPriceCalculator.
export const EUR_TO_RSD = 117.55;
export const TONER_COST_DEFAULT_EUR = 1.1;
export const TONER_COST_CERADA_MESH_EUR = 0.5;

export type PrintSides = "4/0" | "4/4";

export function isCeradaOrMesh(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return /cerad|tarpaulin|mesh|baner.*mesh|pvc.*cerad/.test(t);
}

export function defaultTonerCostEur(text: string | null | undefined): number {
  return isCeradaOrMesh(text) ? TONER_COST_CERADA_MESH_EUR : TONER_COST_DEFAULT_EUR;
}
