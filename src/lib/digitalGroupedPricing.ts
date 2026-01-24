// Grouped Digital Pricing Logic
// Groups items by coverage (4/0, 4/4, etc.) + format (488x330, 760x330)
// Then calculates pricing based on aggregated sheet count per group

import { 
  PRICE_TABLE, 
  PAPER_PRICE_TABLE,
  getCoverageSides,
  COLOR_CLICK_COST_BASE,
  MONO_CLICK_COST_BASE,
  getSheetMultiplier
} from './digitalCalculations';

export interface DigitalJobItem {
  id?: string;
  name?: string;
  file_name?: string;
  obim?: number;
  qty?: number;
  print_sides?: string;
  machine_sheet_format?: string;
  paper_type?: string;
  is_test_print?: boolean;
}

export interface GroupedPricingItem {
  name: string;
  obim: number;
  qty: number;
  sheets: number;
  sheetsForTier: number; // For 760x330, this is sheets * 1.5
}

export interface PricingGroup {
  coverage: string;        // e.g., "4/0"
  format: string;          // e.g., "488x330"
  items: GroupedPricingItem[];
  totalSheets: number;
  totalSheetsForTier: number; // For tier calculation (760x330 = sheets * 1.5)
  tier: { minQty: number; maxQty: number; pricePerSheet: number };
  pricePerSheetBase: number; // Price per 488x330 sheet
  formatMultiplier: number;  // 1.0 or 1.5
  groupTotal: number;        // totalSheets * pricePerSheet * formatMultiplier
}

export interface GroupedPricingResult {
  groups: PricingGroup[];
  totalAmount: number;
  totalSheets: number;
  totalColorClicks: number;
  totalMonoClicks: number;
  totalPaperCost: number;
  totalClickCost: number;
  totalCost: number;
  ruc: number;
  rucPercent: number;
}

// Get tier for a given quantity
function getTierForQuantity(qty: number): { minQty: number; maxQty: number; label: string } {
  for (const tier of PRICE_TABLE) {
    if (qty >= tier.minQty && qty <= tier.maxQty) {
      const maxLabel = tier.maxQty === Infinity ? '∞' : tier.maxQty.toString();
      return { minQty: tier.minQty, maxQty: tier.maxQty, label: `${tier.minQty}-${maxLabel}` };
    }
  }
  // Default to highest tier
  const lastTier = PRICE_TABLE[PRICE_TABLE.length - 1];
  return { minQty: lastTier.minQty, maxQty: lastTier.maxQty, label: `${lastTier.minQty}+` };
}

// Get price per sheet for a given quantity and coverage
function getPriceForTier(qty: number, coverage: string): number {
  const tier = PRICE_TABLE.find(t => qty >= t.minQty && qty <= t.maxQty);
  if (!tier) {
    const lastTier = PRICE_TABLE[PRICE_TABLE.length - 1];
    return lastTier.prices[coverage as keyof typeof lastTier.prices] || 0;
  }
  return tier.prices[coverage as keyof typeof tier.prices] || 0;
}

// Calculate paper cost for all items
function calculatePaperCost(jobs: DigitalJobItem[]): number {
  let total = 0;
  for (const job of jobs) {
    if (job.is_test_print) continue;
    
    const obim = job.obim || 1;
    const qty = job.qty || 0;
    const sheets = obim * qty;
    const paperType = job.paper_type || '';
    const format = job.machine_sheet_format || '488x330';
    
    const basePaperPrice = PAPER_PRICE_TABLE[paperType] ?? 0;
    const paperMultiplier = format === '760x330' ? 1.5 : 1.0;
    
    total += sheets * basePaperPrice * paperMultiplier;
  }
  return total;
}

// Calculate click costs for all items
function calculateClickCosts(jobs: DigitalJobItem[]): { colorClicks: number; monoClicks: number; totalCost: number } {
  let colorClicks = 0;
  let monoClicks = 0;
  
  for (const job of jobs) {
    if (job.is_test_print) continue;
    
    const obim = job.obim || 1;
    const qty = job.qty || 0;
    const sheets = obim * qty;
    const format = job.machine_sheet_format || '488x330';
    const printSides = job.print_sides || '4/4';
    
    const sheetMultiplier = getSheetMultiplier(format);
    const { colorSides, monoSides } = getCoverageSides(printSides);
    
    colorClicks += sheets * colorSides * sheetMultiplier;
    monoClicks += sheets * monoSides * sheetMultiplier;
  }
  
  const totalCost = (colorClicks * COLOR_CLICK_COST_BASE) + (monoClicks * MONO_CLICK_COST_BASE);
  
  return { colorClicks, monoClicks, totalCost };
}

/**
 * Calculate grouped pricing for digital work order
 * Groups items by coverage (print_sides) + format (machine_sheet_format)
 * Then calculates price tier based on aggregated sheets per group
 */
export function calculateGroupedPricing(jobs: DigitalJobItem[]): GroupedPricingResult {
  // Filter out test prints for pricing
  const billableJobs = jobs.filter(j => !j.is_test_print);
  
  // Group by coverage + format
  const groupMap = new Map<string, PricingGroup>();
  
  for (const job of billableJobs) {
    const coverage = job.print_sides || '4/4';
    const format = job.machine_sheet_format || '488x330';
    const key = `${coverage}|${format}`;
    
    const obim = job.obim || 1;
    const qty = job.qty || 0;
    const sheets = obim * qty;
    
    // For 760x330, multiply sheets by 1.5 for tier calculation
    const formatMultiplier = format === '760x330' ? 1.5 : 1.0;
    const sheetsForTier = Math.round(sheets * formatMultiplier);
    
    const itemName = job.name || job.file_name || 'Bez naziva';
    
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        coverage,
        format,
        items: [],
        totalSheets: 0,
        totalSheetsForTier: 0,
        tier: { minQty: 0, maxQty: 0, pricePerSheet: 0 },
        pricePerSheetBase: 0,
        formatMultiplier,
        groupTotal: 0
      });
    }
    
    const group = groupMap.get(key)!;
    group.items.push({
      name: itemName,
      obim,
      qty,
      sheets,
      sheetsForTier
    });
    group.totalSheets += sheets;
    group.totalSheetsForTier += sheetsForTier;
  }
  
  // Calculate pricing for each group
  const groups: PricingGroup[] = [];
  let totalAmount = 0;
  let totalSheets = 0;
  
  for (const group of groupMap.values()) {
    // Get tier based on total sheets for tier (with 1.5x for 760x330)
    const tierInfo = getTierForQuantity(group.totalSheetsForTier);
    const pricePerSheetBase = getPriceForTier(group.totalSheetsForTier, group.coverage);
    
    // For 760x330, apply 1.5x multiplier to price
    // Note: We already used 1.5x for tier calculation, now also for final price
    const groupTotal = group.totalSheets * pricePerSheetBase * group.formatMultiplier;
    
    group.tier = { ...tierInfo, pricePerSheet: pricePerSheetBase };
    group.pricePerSheetBase = pricePerSheetBase;
    group.groupTotal = groupTotal;
    
    totalAmount += groupTotal;
    totalSheets += group.totalSheets;
    
    groups.push(group);
  }
  
  // Sort groups by coverage then format
  groups.sort((a, b) => {
    if (a.coverage !== b.coverage) return a.coverage.localeCompare(b.coverage);
    return a.format.localeCompare(b.format);
  });
  
  // Calculate costs
  const totalPaperCost = calculatePaperCost(jobs);
  const clickCosts = calculateClickCosts(jobs);
  const totalClickCost = clickCosts.totalCost;
  const totalCost = totalPaperCost + totalClickCost;
  const ruc = totalAmount - totalCost;
  const rucPercent = totalAmount > 0 ? (ruc / totalAmount) * 100 : 0;
  
  return {
    groups,
    totalAmount,
    totalSheets,
    totalColorClicks: clickCosts.colorClicks,
    totalMonoClicks: clickCosts.monoClicks,
    totalPaperCost,
    totalClickCost,
    totalCost,
    ruc,
    rucPercent
  };
}

// Format tier label for display
export function formatTierLabel(tier: { minQty: number; maxQty: number }): string {
  if (tier.maxQty === Infinity) return `${tier.minQty}+`;
  return `${tier.minQty}-${tier.maxQty}`;
}
