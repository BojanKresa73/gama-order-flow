// Product-oriented digital pricing
// Converts a "product" (katalog, flajer, poster...) into base print jobs
// (interior + optional cover) used by calculateGroupedPricing, and computes
// finishing line totals separately.

import type { LocalDigitalJob } from "@/components/digital/LocalDigitalJobsTable";
import type {
  DigitalFinishingPrice,
  DigitalFinishingType,
} from "@/hooks/useDigitalFinishings";

export interface PageFormatPreset {
  code: string;
  label: string;
  width_mm: number;
  height_mm: number;
}

export const PAGE_FORMAT_PRESETS: PageFormatPreset[] = [
  { code: "A6", label: "A6 (105 × 148)", width_mm: 105, height_mm: 148 },
  { code: "A5", label: "A5 (148 × 210)", width_mm: 148, height_mm: 210 },
  { code: "A4", label: "A4 (210 × 297)", width_mm: 210, height_mm: 297 },
  { code: "A4_L", label: "A4 položeno (297 × 210)", width_mm: 297, height_mm: 210 },
  { code: "A3", label: "A3 (297 × 420)", width_mm: 297, height_mm: 420 },
  { code: "VIZIT", label: "Vizit (90 × 50)", width_mm: 90, height_mm: 50 },
  { code: "CUSTOM", label: "Po meri", width_mm: 0, height_mm: 0 },
];

export const MACHINE_SHEET_DIMS: Record<string, { w: number; h: number }> = {
  "488x330": { w: 488, h: 330 },
  "700x330": { w: 700, h: 330 },
};

// Binding variants that require booklet imposition (2 pages side-by-side on a spread).
export const BOOKLET_BINDING_VARIANTS = [
  "Klamovanje (žičano)",
  "Šivenje koncem",
];

export function isBookletBinding(variant?: string | null): boolean {
  if (!variant) return false;
  return BOOKLET_BINDING_VARIANTS.includes(variant);
}

/**
 * Does a spread (2 finished pages side-by-side) of pageW × pageH fit on the given sheet?
 * Tries both orientations of the spread.
 */
export function spreadFitsOnSheet(
  pageW: number,
  pageH: number,
  sheetFormat: string
): boolean {
  const dim = MACHINE_SHEET_DIMS[sheetFormat];
  if (!dim || pageW <= 0 || pageH <= 0) return false;
  const spreadW = pageW * 2;
  const spreadH = pageH;
  return (
    (spreadW <= dim.w && spreadH <= dim.h) ||
    (spreadH <= dim.w && spreadW <= dim.h)
  );
}

/**
 * Smallest available machine sheet that can hold a 2-up booklet spread,
 * or null if none fits.
 */
export function minSheetForBooklet(
  pageW: number,
  pageH: number
): string | null {
  const ordered = ["488x330", "700x330"];
  for (const f of ordered) {
    if (spreadFitsOnSheet(pageW, pageH, f)) return f;
  }
  return null;
}

/**
 * How many finished pages of a given format fit on one machine sheet.
 * Simple capacity-fit (no rotation optimization beyond basic both-orientations check).
 */
export function pagesPerSheet(
  pageW: number,
  pageH: number,
  sheetFormat: string
): number {
  const dim = MACHINE_SHEET_DIMS[sheetFormat] ?? MACHINE_SHEET_DIMS["488x330"];
  if (pageW <= 0 || pageH <= 0) return 1;
  const a = Math.floor(dim.w / pageW) * Math.floor(dim.h / pageH);
  const b = Math.floor(dim.w / pageH) * Math.floor(dim.h / pageW);
  return Math.max(1, a, b);
}

export interface FinishingLine {
  code: string;
  name: string;
  variant: string;
  pricing_model: string;
  qty: number;          // copies / sheets / items used as multiplier
  unit_price: number;
  fixed_cost: number;
  total: number;
  notes?: string;
}

export function calcFinishingTotal(
  type: DigitalFinishingType,
  price: DigitalFinishingPrice,
  qty: number,
  areaM2: number = 0
): number {
  const u = price.unit_price || 0;
  const f = price.fixed_cost || 0;
  switch (type.pricing_model) {
    case "fixed":
      return f;
    case "per_copy":
    case "per_item":
    case "per_sheet":
      return u * qty;
    case "per_m2":
      return u * areaM2;
    case "fixed_plus_per_copy":
      return f + u * qty;
    default:
      return f + u * qty;
  }
}

export interface ProductDraft {
  product_code: string;
  name: string;
  qty: number;
  page_count: number; // total pages incl. covers (1 for single-page products)
  page_format: string;
  page_width_mm: number;
  page_height_mm: number;
  machine_sheet_format: string;
  // Interior
  paper_type: string;
  print_sides: string;
  // Cover (optional)
  has_cover: boolean;
  cover_paper?: string;
  cover_print_sides?: string;
  cover_lamination?: string;
  binding_code?: string;
  // Finishings
  finishings: Array<{
    code: string;
    variant: string;
    qty?: number; // optional override; default = product qty
  }>;
}

export interface BuiltProduct {
  jobs: LocalDigitalJob[];      // 1 (interior) or 2 (interior + cover)
  finishings: FinishingLine[];
  finishingsTotal: number;
}

/**
 * Convert a ProductDraft + finishing catalog into LocalDigitalJob entries
 * plus computed finishing lines.
 */
export function buildProductJobs(
  draft: ProductDraft,
  finishingTypes: DigitalFinishingType[],
  finishingPrices: DigitalFinishingPrice[],
  preserveGroupId?: string
): BuiltProduct {
  const jobs: LocalDigitalJob[] = [];
  const groupId =
    preserveGroupId ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const interiorPages = draft.has_cover
    ? Math.max(0, draft.page_count - 4) // assume 4-page cover when separate
    : draft.page_count;

  const nUp = pagesPerSheet(
    draft.page_width_mm,
    draft.page_height_mm,
    draft.machine_sheet_format
  );

  // ----- Interior job -----
  if (interiorPages > 0) {
    const sidesFactor = draft.print_sides.includes("/0") ? 1 : 2;
    // Booklet (klamovanje / šivenje) uses spread imposition: each physical sheet
    // carries 2 pages side-by-side per face → 2 * sidesFactor pages per sheet,
    // regardless of geometric n-up (the extra width is waste/bleed).
    const hasBookletBinding = draft.finishings.some((f) =>
      isBookletBinding(f.variant)
    );
    const pagesPerPhysicalSheet = hasBookletBinding
      ? 2 * sidesFactor
      : nUp * sidesFactor;
    const sheetsPerCopy = Math.max(
      1,
      Math.ceil(interiorPages / pagesPerPhysicalSheet)
    );

    jobs.push({
      file_name: draft.name || draft.product_code,
      name: draft.name || draft.product_code,
      finished_w_mm: draft.page_width_mm,
      finished_h_mm: draft.page_height_mm,
      pages: interiorPages,
      obim: sheetsPerCopy,
      qty: draft.qty,
      is_test_print: false,
      print_sides: draft.print_sides,
      paper_type: draft.paper_type,
      machine_sheet_format: draft.machine_sheet_format,
      pieces_count: draft.qty,
      product_code: draft.product_code,
      page_count: draft.page_count,
      page_format: draft.page_format,
      page_width_mm: draft.page_width_mm,
      page_height_mm: draft.page_height_mm,
      has_cover: draft.has_cover,
      cover_paper: draft.cover_paper,
      cover_print_sides: draft.cover_print_sides,
      cover_lamination: draft.cover_lamination,
      binding_code: draft.binding_code,
      product_group_id: groupId,
    });
  }

  // ----- Cover job (1 sheet/copy by default) -----
  if (draft.has_cover) {
    jobs.push({
      file_name: `${draft.name || draft.product_code} — korice`,
      name: `${draft.name || draft.product_code} — korice`,
      finished_w_mm: draft.page_width_mm,
      finished_h_mm: draft.page_height_mm,
      pages: 4,
      obim: 1,
      qty: draft.qty,
      is_test_print: false,
      print_sides: draft.cover_print_sides || "4/4",
      paper_type: draft.cover_paper || draft.paper_type,
      machine_sheet_format: draft.machine_sheet_format,
      pieces_count: draft.qty,
      product_code: draft.product_code,
      product_group_id: groupId,
      has_cover: false, // cover-of-cover not allowed
    });
  }

  // ----- Finishings -----
  const finishingLines: FinishingLine[] = [];
  for (const f of draft.finishings) {
    const type = finishingTypes.find((t) => t.code === f.code);
    if (!type) continue;
    const price = finishingPrices.find(
      (p) => p.finishing_code === f.code && (p.variant || "") === (f.variant || "")
    );
    if (!price) continue;

    const qty = f.qty && f.qty > 0 ? f.qty : draft.qty;
    const areaM2 =
      (draft.page_width_mm * draft.page_height_mm * qty) / 1_000_000;
    const total = calcFinishingTotal(type, price, qty, areaM2);

    finishingLines.push({
      code: f.code,
      name: type.name,
      variant: price.variant,
      pricing_model: type.pricing_model,
      qty,
      unit_price: price.unit_price,
      fixed_cost: price.fixed_cost,
      total,
      notes: price.notes ?? undefined,
    });
  }

  // Cover lamination as auto-added finishing
  if (draft.has_cover && draft.cover_lamination && draft.cover_lamination !== "none") {
    const type = finishingTypes.find((t) => t.code === "plastifikacija");
    const price = finishingPrices.find(
      (p) =>
        p.finishing_code === "plastifikacija" &&
        p.variant === draft.cover_lamination
    );
    if (type && price) {
      const qty = draft.qty;
      const areaM2 =
        (draft.page_width_mm * draft.page_height_mm * qty) / 1_000_000;
      const total = calcFinishingTotal(type, price, qty, areaM2);
      finishingLines.push({
        code: "plastifikacija",
        name: `${type.name} (korice)`,
        variant: price.variant,
        pricing_model: type.pricing_model,
        qty,
        unit_price: price.unit_price,
        fixed_cost: price.fixed_cost,
        total,
      });
    }
  }

  const finishingsTotal = finishingLines.reduce((s, l) => s + l.total, 0);

  // Stash finishings on first job so they persist in LocalDigitalJob list
  if (jobs.length > 0) {
    jobs[0].finishings = finishingLines;
    jobs[0].finishings_total = finishingsTotal;
  }

  return { jobs, finishings: finishingLines, finishingsTotal };
}

/**
 * Reconstruct a ProductDraft from the interior LocalDigitalJob (the one that
 * carries product_code + stashed finishings). Used when editing an existing
 * product group.
 */
export function reconstructDraftFromJob(job: LocalDigitalJob): ProductDraft {
  // Filter out the auto-added cover lamination finishing — it's re-derived
  // from cover_lamination, not stored as an explicit user pick.
  const userFinishings = (job.finishings ?? [])
    .filter(
      (f) =>
        !(
          job.has_cover &&
          job.cover_lamination &&
          job.cover_lamination !== "none" &&
          f.code === "plastifikacija" &&
          f.variant === job.cover_lamination
        )
    )
    .map((f) => ({ code: f.code, variant: f.variant, qty: f.qty }));

  return {
    product_code: job.product_code || "katalog",
    name: job.name || job.file_name || "",
    qty: job.qty || 1,
    page_count: job.page_count || 1,
    page_format: job.page_format || "A4",
    page_width_mm: job.page_width_mm || job.finished_w_mm || 210,
    page_height_mm: job.page_height_mm || job.finished_h_mm || 297,
    machine_sheet_format: job.machine_sheet_format || "488x330",
    paper_type: job.paper_type || "",
    print_sides: job.print_sides || "4/4",
    has_cover: !!job.has_cover,
    cover_paper: job.cover_paper,
    cover_print_sides: job.cover_print_sides,
    cover_lamination: job.cover_lamination || "none",
    binding_code: job.binding_code || "none",
    finishings: userFinishings,
  };
}

