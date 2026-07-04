/**
 * Turn a ParsedTenderItem (AI-classified as "digital") into an initialDraft
 * that DigitalProductDialog can render directly. Guesses product_code from
 * name and picks a sane machine sheet based on trimmed page size.
 */

import type { ParsedTenderItem } from "@/lib/tenderImport";
import type { ProductDraft } from "@/lib/digitalProductPricing";

const PRODUCT_CODE_RULES: Array<{ rx: RegExp; code: string }> = [
  { rx: /katalog|brošur|brosur|knjižic|knjizic|monograf/i, code: "katalog" },
  { rx: /flajer|letak|leaflet/i, code: "flajer" },
  { rx: /vizit|business\s*card/i, code: "vizit" },
  { rx: /plakat|poster/i, code: "poster" },
  { rx: /blok|memorandum|ncr|obrazac|deklaracij/i, code: "blok" },
];

function guessProductCode(name: string, pages: number | null): string {
  const t = name.toLowerCase();
  for (const { rx, code } of PRODUCT_CODE_RULES) if (rx.test(t)) return code;
  // Multi-page → treat as katalog by default
  if ((pages ?? 1) > 2) return "katalog";
  return "custom";
}

function pickSheet(w: number, h: number): "488x330" | "700x330" {
  const max = Math.max(w, h);
  return max > 488 ? "700x330" : "488x330";
}

function pickPageFormat(w: number, h: number): string {
  // Return preset code if it matches, else CUSTOM
  const dims = [w, h].sort((a, b) => a - b).join("x");
  const map: Record<string, string> = {
    "148x210": "A5", "210x297": "A4", "105x148": "A6",
    "297x420": "A3", "70x100": "A7",
  };
  return map[dims] ?? "CUSTOM";
}

function paperName(paper: string | null | undefined, gsm: number | null | undefined): string {
  const base = (paper ?? "Kunzdruk").trim();
  if (gsm && gsm > 0) {
    // Avoid double gsm ("Kunzdruk 135g 135g")
    if (/\d{2,4}\s*g/i.test(base)) return base;
    return `${base} ${gsm}g`;
  }
  return base;
}

/** Map digital finishing flags (sf_*) → finishings entries in ProductDraft. */
function buildFinishings(sp: NonNullable<ParsedTenderItem["digital"]>): ProductDraft["finishings"] {
  const out: ProductDraft["finishings"] = [];
  const push = (code: string, variant: string) => out.push({ code, variant });

  if (sp.sf_stapling) push("klamovanje", "default");
  if (sp.sf_spiral_binding) push("spirala", "default");
  if (sp.sf_thermal_binding || sp.sf_softcover) push("lepljenje", "default");
  if (sp.sf_hardcover) push("tvrdi_povez", "default");
  if (sp.sf_thread_sewing) push("sivenje", "default");
  if (sp.sf_lamination) push("plastifikacija", sp.sf_uv_full ? "sjaj" : "mat");
  if (sp.sf_folding) push("falcovanje", "default");
  if (sp.sf_creasing) push("bigovanje", "default");
  if (sp.sf_perforation) push("perforacija", "default");
  if (sp.sf_hole_punching) push("busenje", "default");
  if (sp.sf_die_cutting) push("stancovanje", "default");
  if (sp.sf_numbering) push("numeracija", "default");
  if (sp.sf_uv_partial) push("uv_lak", "parcijalni");
  if (sp.sf_uv_full && !sp.sf_lamination) push("uv_lak", "puni");
  if (sp.sf_gold_foil) push("zlatotisk", "default");
  if (sp.sf_mounting) push("kasiranje", "default");
  return out;
}

export function parsedItemToProductDraft(item: ParsedTenderItem): ProductDraft {
  const sp = item.digital;
  const pages = sp?.pages ?? null;
  const product_code = guessProductCode(item.name, pages);
  const w = item.width_mm ?? 210;
  const h = item.height_mm ?? 297;
  const hasCover = product_code === "katalog";
  return {
    product_code,
    name: item.name,
    qty: item.quantity || 100,
    page_count: pages ?? (product_code === "katalog" ? 8 : 1),
    page_format: pickPageFormat(w, h),
    page_width_mm: w,
    page_height_mm: h,
    machine_sheet_format: sp?.sheet_format ?? pickSheet(w, h),
    paper_type: paperName(sp?.paper_type, sp?.paper_gsm),
    print_sides: sp?.print_sides ?? "4/4",
    has_cover: hasCover,
    cover_paper: hasCover ? "Kunzdruk 300g" : undefined,
    cover_print_sides: hasCover ? "4/4" : undefined,
    cover_lamination: hasCover && sp?.sf_lamination ? "mat" : "none",
    binding_code: sp?.sf_stapling ? "klamovanje"
      : sp?.sf_spiral_binding ? "spirala"
      : sp?.sf_thermal_binding || sp?.sf_softcover ? "lepljenje"
      : sp?.sf_hardcover ? "tvrdi_povez"
      : "none",
    finishings: sp ? buildFinishings(sp) : [],
  };
}
