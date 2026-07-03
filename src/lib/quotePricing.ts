export const EUR_TO_RSD = 117.55;
export const TONER_COST_DEFAULT_EUR = 1.1;
export const TONER_COST_CERADA_MESH_EUR = 0.5;

export type PrintSides = "4/0" | "4/4";

export interface LargeFormatPricingInput {
  areaM2: number;
  quantity: number;
  costPerM2: number;
  tonerCostPerM2Eur: number;
  finishingCost: number;
  markupPercent: number;
  customPrice?: number | null;
  printSides?: PrintSides;
  installationTotalRsd?: number;
}

export interface InstallationOptions {
  standardEnabled: boolean;
  standardPricePerM2Eur: number;
  standardFixedStartEur: number;
  highEnabled: boolean;
  highPricePerM2Eur: number;
  highFixedStartEur: number;
}

export const INSTALLATION_FIXED_START_THRESHOLD_M2 = 10;

export function computeInstallationCostEur(areaM2: number, opts: InstallationOptions): number {
  const area = Math.max(0, Number(areaM2 || 0));
  let total = 0;
  if (opts.standardEnabled) {
    total += Number(opts.standardPricePerM2Eur || 0) * area;
    total += Number(opts.standardFixedStartEur || 0);
  }
  if (opts.highEnabled) {
    total += Number(opts.highPricePerM2Eur || 0) * area;
    total += Number(opts.highFixedStartEur || 0);
  }
  return total;
}

export interface LargeFormatPricingResult {
  areaM2: number;
  materialCost: number;
  tonerCostRsd: number;
  baseCost: number;
  unitCost: number;
  calculatedUnitPrice: number;
  unitPrice: number;
  installationCostPerUnit: number;
  installationCostTotal: number;
  lineTotal: number;
  profitPerUnit: number;
  profitTotal: number;
}

export function isCeradaOrMesh(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return /cerad|tarpaulin|mesh|baner.*mesh|pvc.*cerad/.test(t);
}

export function defaultTonerCostEur(text: string | null | undefined): number {
  return isCeradaOrMesh(text) ? TONER_COST_CERADA_MESH_EUR : TONER_COST_DEFAULT_EUR;
}

export function computeLargeFormatPricing({
  areaM2, quantity, costPerM2, tonerCostPerM2Eur, finishingCost, markupPercent,
  customPrice, printSides = "4/0", installationTotalRsd = 0,
}: LargeFormatPricingInput): LargeFormatPricingResult {
  const safeArea = Number(areaM2 || 0);
  const safeQty = Math.max(0, Number(quantity || 0));
  const safeCostPerM2 = Number(costPerM2 || 0);
  const safeToner = Number(tonerCostPerM2Eur || 0);
  const safeFinishing = Number(finishingCost || 0);
  const safeMarkup = Number(markupPercent || 0);
  const safeInstallTotal = Math.max(0, Number(installationTotalRsd || 0));
  const tonerMultiplier = printSides === "4/4" ? 2 : 1;

  const materialCost = safeCostPerM2 * safeArea;
  const tonerCostRsd = safeToner * tonerMultiplier * EUR_TO_RSD * safeArea;
  const baseCost = materialCost + tonerCostRsd;
  const calculatedUnitPrice = baseCost * (1 + safeMarkup / 100) + safeFinishing;
  const basePrice = customPrice ?? calculatedUnitPrice;
  const unitPrice = basePrice;
  const lineTotal = unitPrice * safeQty + safeInstallTotal;
  const installationCostTotal = safeInstallTotal;
  const installationCostPerUnit = safeQty > 0 ? safeInstallTotal / safeQty : safeInstallTotal;
  const profitPerUnit = basePrice - baseCost - safeFinishing;
  const profitTotal = profitPerUnit * safeQty;

  return {
    areaM2: safeArea, materialCost, tonerCostRsd, baseCost,
    unitCost: baseCost, calculatedUnitPrice, unitPrice,
    installationCostPerUnit, installationCostTotal, lineTotal,
    profitPerUnit, profitTotal,
  };
}

export function deriveStoredTonerCostPerM2Eur(input: {
  areaM2?: number | null;
  unitCost?: number | null;
  costPerM2?: number | null;
  finishingCost?: number | null;
}): number {
  const area = Number(input.areaM2 || 0);
  if (area <= 0) return 0;
  const unitCost = Number(input.unitCost || 0);
  const materialCost = Number(input.costPerM2 || 0) * area;
  const tonerCostRsd = unitCost - materialCost;
  if (tonerCostRsd <= 0) return 0;
  const derived = tonerCostRsd / EUR_TO_RSD / area;
  if (derived > 50) return 0;
  return derived;
}
