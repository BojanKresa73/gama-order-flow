// Simplified Digital Sheet Logic
// Each row = imposed sheet file, only 488×330 and 760×330 formats

export interface DigitalSettings {
  sheet_width_mm: number;
  sheet_height_mm: number;
  waste_percent: number;
  available_sheet_formats?: string[];
}

export interface PriceListEntry {
  break_qty: number;
  price_per_sheet: number;
}

export interface DigitalJob {
  name?: string;
  file_name: string;
  finished_w_mm: number;
  finished_h_mm: number;
  pages: number;
  obim: number; // Number of imposed sheets per one finished copy
  qty: number; // Number of finished copies (Tiraž)
  is_test_print: boolean;
  print_sides: string; // "4/4", "4/0", "4/1", "1/0", "1/1"
  paper_type?: string;
  machine_sheet_format?: string; // "488x330" or "760x330"
  pieces_per_sheet_override?: number | null;
  test_sheets?: number;
  include_test_in_clicks?: boolean;
  cover_gsm?: number;
  lamination?: string;
  finishing?: string;
}

export interface ComputedDigitalJob {
  computed_nup: number;
  computed_sheets_per_copy: number;
  computed_total_sheets: number;
  computed_color_clicks: number;
  computed_mono_clicks: number;
  computed_price_per_sheet: number;
  computed_line_total: number;
  cover_sheets: number;
  lamination_sheets: number;
  pieces_per_sheet: number;
  sheets_for_production: number;
  sheets_for_test: number;
}

// Sheet formats
export const SHEET_FORMATS = ["488x330", "760x330"] as const;

// Print modes / coverage options
export const PRINT_MODES = ["4/4", "4/0", "4/1", "1/0", "1/1"] as const;

// Pricing table per SHEET (488x330) by tirage range and coverage
// For 760x330 format, multiply by 1.5
export const PRICE_TABLE = [
  { minQty: 1, maxQty: 10, prices: { "4/0": 0.82, "4/4": 1.38, "4/1": 1.06, "1/0": 0.29, "1/1": 0.45 } },
  { minQty: 11, maxQty: 20, prices: { "4/0": 0.77, "4/4": 1.28, "4/1": 0.99, "1/0": 0.27, "1/1": 0.42 } },
  { minQty: 21, maxQty: 50, prices: { "4/0": 0.73, "4/4": 1.20, "4/1": 0.91, "1/0": 0.23, "1/1": 0.35 } },
  { minQty: 51, maxQty: 100, prices: { "4/0": 0.61, "4/4": 1.04, "4/1": 0.79, "1/0": 0.21, "1/1": 0.31 } },
  { minQty: 101, maxQty: 500, prices: { "4/0": 0.48, "4/4": 0.78, "4/1": 0.60, "1/0": 0.16, "1/1": 0.24 } },
  { minQty: 501, maxQty: 1000, prices: { "4/0": 0.41, "4/4": 0.69, "4/1": 0.51, "1/0": 0.15, "1/1": 0.21 } },
  { minQty: 1001, maxQty: Infinity, prices: { "4/0": 0.39, "4/4": 0.65, "4/1": 0.49, "1/0": 0.14, "1/1": 0.20 } },
];

// Paper price table per sheet 488×330 (from Bojan's Excel column F)
export const PAPER_PRICE_TABLE: Record<string, number> = {
  "Ofsetni": 0.01, // Default Ofsetni
  "Ofsetni 80g": 0.01,
  "Ofsetni 100g": 0.02,
  "Kunzdruk 115g": 0.03,
  "Kunzdruk 135g": 0.03,
  "Kunzdruk 150g": 0.04,
  "Kunzdruk 170g": 0.04,
  "Kunzdruk 200g": 0.05,
  "Kunzdruk 220g": 0.05,
  "Kunzdruk 250g": 0.06,
  "Kunzdruk 300g": 0.07,
  "Kunzdruk 350g": 0.09,
  "Kunzdruk 400g": 0.10,
  "Specijalni": 0, // Special paper - cost 0 for now
};

// Click cost per A3 equivalent
export const COLOR_CLICK_COST_BASE = 0.06; // €/click
export const MONO_CLICK_COST_BASE = 0.016; // €/click

// Get sheet multiplier for click calculation (A3 equivalents)
// 488×330 = 1.0 (base A3)
// 760×330 = 1.5 (50% more)
export function getSheetMultiplier(format: string): number {
  if (format === "760x330") return 1.5;
  return 1.0; // Default 488x330
}

export function getPricingSheetCount(totalSheets: number, format: string): number {
  return Math.round(totalSheets * getSheetMultiplier(format));
}

// Get A4 factor for pricing
// 488×330 = 2 A4
// 760×330 = 3 A4
export function getA4Factor(format: string): number {
  if (format === "760x330") return 3;
  return 2; // Default 488x330
}

// Coverage to sides mapping
export function getCoverageSides(printSides: string): { colorSides: number; monoSides: number } {
  switch (printSides) {
    case "4/0":
      return { colorSides: 1, monoSides: 0 };
    case "4/4":
      return { colorSides: 2, monoSides: 0 };
    case "4/1":
      return { colorSides: 1, monoSides: 1 };
    case "1/0":
      return { colorSides: 0, monoSides: 1 };
    case "1/1":
      return { colorSides: 0, monoSides: 2 };
    default:
      return { colorSides: 0, monoSides: 0 };
  }
}

// Progressive (cumulative) pricing: each tier price applies only to sheets within that tier's range.
// Example for 200 sheets 4/0: 10*1.00 + 10*0.85 + 30*0.77 + 50*0.68 + 100*0.47 = 122.60
export function calculateProgressivePrice(totalSheets: number, coverage: string): number {
  if (totalSheets <= 0) return 0;
  let remaining = totalSheets;
  let prevMax = 0;
  let total = 0;
  for (const tier of PRICE_TABLE) {
    const tierCapacity = tier.maxQty === Infinity ? remaining : tier.maxQty - prevMax;
    const sheetsInTier = Math.min(remaining, tierCapacity);
    const price = tier.prices[coverage as keyof typeof tier.prices] || 0;
    total += sheetsInTier * price;
    remaining -= sheetsInTier;
    prevMax = tier.maxQty;
    if (remaining <= 0) break;
  }
  return total;
}

// Per-tier progressive breakdown for display: returns the segments used
export interface ProgressiveSegment {
  minQty: number;
  maxQty: number;
  sheetsInTier: number;
  pricePerSheet: number;
  subtotal: number;
}
export function getProgressiveBreakdown(totalSheets: number, coverage: string): ProgressiveSegment[] {
  const segments: ProgressiveSegment[] = [];
  if (totalSheets <= 0) return segments;
  let remaining = totalSheets;
  let prevMax = 0;
  for (const tier of PRICE_TABLE) {
    const tierCapacity = tier.maxQty === Infinity ? remaining : tier.maxQty - prevMax;
    const sheetsInTier = Math.min(remaining, tierCapacity);
    const price = tier.prices[coverage as keyof typeof tier.prices] || 0;
    if (sheetsInTier > 0) {
      segments.push({
        minQty: tier.minQty,
        maxQty: tier.maxQty,
        sheetsInTier,
        pricePerSheet: price,
        subtotal: sheetsInTier * price,
      });
    }
    remaining -= sheetsInTier;
    prevMax = tier.maxQty;
    if (remaining <= 0) break;
  }
  return segments;
}

// Get effective (average) price per sheet for display purposes
export function getPricePerSheet(totalSheets: number, coverage: string): number {
  if (totalSheets <= 0) return 0;
  return calculateProgressivePrice(totalSheets, coverage) / totalSheets;
}

// Calculate total sheets for an item
export function calculateTotalSheets(obim: number, qty: number): number {
  return (obim || 1) * (qty || 0);
}

// Calculate clicks for a single item
export function calculateItemClicks(
  obim: number,
  qty: number,
  format: string,
  printSides: string
): { colorClicks: number; monoClicks: number; totalSheets: number } {
  const totalSheets = calculateTotalSheets(obim, qty);
  const sheetMultiplier = getSheetMultiplier(format);
  const { colorSides, monoSides } = getCoverageSides(printSides);
  
  return {
    totalSheets,
    colorClicks: totalSheets * colorSides * sheetMultiplier,
    monoClicks: totalSheets * monoSides * sheetMultiplier,
  };
}

// Calculate price for a single item using progressive tier pricing
// 1.5x multiplier applied for 760x330 format
export function calculateItemPrice(
  obim: number,
  qty: number,
  format: string,
  printSides: string
): number {
  const totalSheets = calculateTotalSheets(obim, qty);
  return calculateProgressivePrice(getPricingSheetCount(totalSheets, format), printSides);
}

// Legacy function for backward compatibility
export function parseSheetFormat(format: string): { width: number; height: number } {
  if (format === '760x330' || format === '330x760') {
    return { width: 760, height: 330 };
  }
  return { width: 488, height: 330 };
}

// Legacy function - no longer used in simplified logic
export function calculatePiecesPerSheet(
  finishedW: number,
  finishedH: number,
  sheetFormat: string
): number {
  const sheet = parseSheetFormat(sheetFormat);
  
  const nup0_w = Math.floor(sheet.width / finishedW);
  const nup0_h = Math.floor(sheet.height / finishedH);
  const nup0 = nup0_w * nup0_h;

  const nup90_w = Math.floor(sheet.width / finishedH);
  const nup90_h = Math.floor(sheet.height / finishedW);
  const nup90 = nup90_w * nup90_h;

  return Math.max(nup0, nup90, 1);
}

// Legacy function - returns simplified computed values for backward compatibility
export function getClicksPerSheet(printSides: string): { colorClicks: number; monoClicks: number } {
  const { colorSides, monoSides } = getCoverageSides(printSides);
  return { colorClicks: colorSides, monoClicks: monoSides };
}

// Simplified compute function for new logic
export function computeDigitalJob(
  job: DigitalJob,
  settings: DigitalSettings,
  priceList: PriceListEntry[]
): ComputedDigitalJob | { error: string } {
  const obim = job.obim || 1;
  const qty = job.qty || 0;
  const format = job.machine_sheet_format || '488x330';
  const printSides = job.print_sides || '4/4';
  
  // Calculate clicks
  const { colorClicks, monoClicks, totalSheets } = calculateItemClicks(obim, qty, format, printSides);
  
  // Calculate price
  const lineTotal = job.is_test_print ? 0 : calculateItemPrice(obim, qty, format, printSides);

  return {
    computed_nup: 1, // Not used in simplified logic
    computed_sheets_per_copy: obim, // Now represents obim
    computed_total_sheets: totalSheets,
    computed_color_clicks: colorClicks,
    computed_mono_clicks: monoClicks,
    computed_price_per_sheet: 0, // Not used in simplified logic
    computed_line_total: lineTotal,
    cover_sheets: 0,
    lamination_sheets: 0,
    pieces_per_sheet: 1,
    sheets_for_production: totalSheets,
    sheets_for_test: 0,
  };
}

// Aggregate totals by paper type for work order summary
export function aggregateByPaperType(jobs: (DigitalJob & Partial<ComputedDigitalJob>)[]): Map<string, number> {
  const result = new Map<string, number>();
  
  for (const job of jobs) {
    const paperType = job.paper_type || 'Neodređeno';
    const totalSheets = calculateTotalSheets(job.obim || 1, job.qty || 0);
    result.set(paperType, (result.get(paperType) || 0) + totalSheets);
  }
  
  return result;
}

// Get paper price per sheet for a given paper type and format
export function getPaperPricePerSheet(paperType: string, format: string): number {
  const basePrice = PAPER_PRICE_TABLE[paperType] ?? 0;
  const paperMultiplier = format === "760x330" ? 1.5 : 1.0;
  return basePrice * paperMultiplier;
}

// Calculate paper cost for a single item
export function calculateItemPaperCost(
  obim: number,
  qty: number,
  format: string,
  paperType: string
): number {
  const totalSheets = calculateTotalSheets(obim, qty);
  const pricePerSheet = getPaperPricePerSheet(paperType, format);
  return totalSheets * pricePerSheet;
}

// Calculate click cost for a single item
export function calculateItemClickCost(
  obim: number,
  qty: number,
  format: string,
  printSides: string
): { colorClickCost: number; monoClickCost: number; totalClickCost: number } {
  const { colorClicks, monoClicks } = calculateItemClicks(obim, qty, format, printSides);
  const colorClickCost = colorClicks * COLOR_CLICK_COST_BASE;
  const monoClickCost = monoClicks * MONO_CLICK_COST_BASE;
  return {
    colorClickCost,
    monoClickCost,
    totalClickCost: colorClickCost + monoClickCost,
  };
}

// Calculate work order totals with new logic including paper cost, click cost, and RUC
export function calculateWorkOrderTotals(jobs: (DigitalJob & Partial<ComputedDigitalJob>)[]) {
  let totalSheets = 0;
  let totalColorClicks = 0;
  let totalMonoClicks = 0;
  let totalAmount = 0;
  let totalPaperCost = 0;
  let totalColorClickCost = 0;
  let totalMonoClickCost = 0;

  for (const job of jobs) {
    const obim = job.obim || 1;
    const qty = job.qty || 0;
    const format = job.machine_sheet_format || '488x330';
    const printSides = job.print_sides || '4/4';
    const paperType = job.paper_type || '';
    
    const { colorClicks, monoClicks, totalSheets: itemSheets } = calculateItemClicks(obim, qty, format, printSides);
    
    totalSheets += itemSheets;
    totalColorClicks += colorClicks;
    totalMonoClicks += monoClicks;
    
    // Paper cost
    totalPaperCost += calculateItemPaperCost(obim, qty, format, paperType);
    
    // Click cost
    const { colorClickCost, monoClickCost } = calculateItemClickCost(obim, qty, format, printSides);
    totalColorClickCost += colorClickCost;
    totalMonoClickCost += monoClickCost;
    
    if (!job.is_test_print) {
      totalAmount += calculateItemPrice(obim, qty, format, printSides);
    }
  }

  const totalClickCost = totalColorClickCost + totalMonoClickCost;
  const totalCost = totalPaperCost + totalClickCost;
  const ruc = totalAmount - totalCost;
  const rucPercent = totalAmount > 0 ? (ruc / totalAmount) * 100 : 0;

  return {
    totalSheets,
    totalColorClicks,
    totalMonoClicks,
    totalClicks: totalColorClicks + totalMonoClicks,
    totalAmount,
    totalPaperCost,
    totalColorClickCost,
    totalMonoClickCost,
    totalClickCost,
    totalCost,
    ruc,
    rucPercent,
    sheetsByPaper: aggregateByPaperType(jobs),
  };
}
