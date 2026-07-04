/**
 * Extracts digital-print specific fields from free-text descriptions:
 * pages, print sides, paper type/gsm, sheet format and finishing flags
 * (sf_* booleans that live on quote_items). Used by the tender importer
 * so imported items land in the digital workspace fully configured.
 */

export interface DigitalSpec {
  pages: number | null;
  print_sides: "4/0" | "4/4";
  paper_type: string | null;
  paper_gsm: number | null;
  sheet_format: "488x330" | "700x330" | null;
  sheet_finishing_enabled: boolean;
  sheet_finishing_notes: string | null;
  sf_cutting: boolean;
  sf_creasing: boolean;
  sf_folding: boolean;
  sf_perforation: boolean;
  sf_hole_punching: boolean;
  sf_stapling: boolean;
  sf_spiral_binding: boolean;
  sf_thermal_binding: boolean;
  sf_thread_sewing: boolean;
  sf_hardcover: boolean;
  sf_softcover: boolean;
  sf_numbering: boolean;
  sf_block_gluing: boolean;
  sf_lamination: boolean;
  sf_uv_partial: boolean;
  sf_uv_full: boolean;
  sf_die_cutting: boolean;
  sf_grommets: boolean;
  sf_mounting: boolean;
  sf_gold_foil: boolean;
}

const FINISHING_PATTERNS: Array<{ key: keyof DigitalSpec; rx: RegExp }> = [
  { key: "sf_stapling",        rx: /klamerov\w*|klamer(?:ic\w*)?|šiveno\s*klamer|siveno\s*klamer|stapl/i },
  { key: "sf_lamination",      rx: /plastifikacij|laminacij|lamin\b/i },
  { key: "sf_softcover",       rx: /meki\s*povez|softcover|topli\s*lepak\s*.*korice/i },
  { key: "sf_hardcover",       rx: /tvrdi\s*povez|hardcover|tvrde\s*korice/i },
  { key: "sf_spiral_binding",  rx: /spiral\w*|wire[- ]?o/i },
  { key: "sf_thermal_binding", rx: /topli\s*lepak|termopovez|thermal\s*bind/i },
  { key: "sf_thread_sewing",   rx: /šiven\w*\s*konc|siven\w*\s*konc|thread\s*sew/i },
  { key: "sf_folding",         rx: /falcov\w*|savijanj\w*|savijan|fold(?:ing)?/i },
  { key: "sf_creasing",        rx: /bigov\w*|big(?:uje)?|crease|riluj/i },
  { key: "sf_cutting",         rx: /obreziv\w*|obrezan\w*\s*na\s*format|sečen\w*|secen\w*|rezan\w*\s*na\s*format|trim(?:ming)?/i },
  { key: "sf_perforation",     rx: /perforacij|perfor\w*/i },
  { key: "sf_hole_punching",   rx: /bušenj\w*\s*rup|busenj\w*\s*rup|hole\s*punch/i },
  { key: "sf_numbering",       rx: /numeracij|numer\w*/i },
  { key: "sf_die_cutting",     rx: /štancan\w*|stancan\w*|štanc\b|stanc\b|die\s*cut/i },
  { key: "sf_uv_full",         rx: /uv\s*lak\s*pun|puni\s*uv|full\s*uv|uv\s*lak\s*1\/0|uv\s*po\s*ce(l|l)/i },
  { key: "sf_uv_partial",      rx: /parcijaln\w*\s*uv|selektivn\w*\s*uv|partial\s*uv|3d\s*uv/i },
  { key: "sf_gold_foil",       rx: /zlatotisk|zlatna\s*folij|hot\s*stamp|folijopis|gold\s*foil/i },
  { key: "sf_grommets",        rx: /ringle|grommets?/i },
  { key: "sf_mounting",        rx: /kaširanj\w*|kasiranj\w*|mount(?:ing)?/i },
  { key: "sf_block_gluing",    rx: /lepljenj\w*\s*blok|block\s*glu/i },
];

function normalizePrintSides(text: string): "4/0" | "4/4" {
  if (!text) return "4/0";
  const t = text.toLowerCase();
  const m = t.match(/\b([14])\s*[\/+]\s*([0-4])\b/);
  if (m) {
    const front = m[1] === "4" ? "4" : "4";  // any color → 4
    const back = m[2] === "0" ? "0" : "4";
    return `${front}/${back}` as "4/0" | "4/4";
  }
  if (/obostran|dvostran|duplex|4\+4|kolor\s+obostr/i.test(t)) return "4/4";
  if (/jednostran|simplex|kolor\s+jednos/i.test(t)) return "4/0";
  return "4/0";
}

function extractPages(text: string): number | null {
  // "8 strana", "12 str.", "Obim: korice + 8 strana"
  const m = text.match(/(\d{1,3})\s*(?:strana|str\.?|pages?)/i);
  if (m) {
    const n = Number(m[1]);
    if (n > 0 && n <= 2000) return n;
  }
  // "obim: korice + 8 strana" — already caught above
  return null;
}

function extractPaper(text: string): { paper_type: string | null; paper_gsm: number | null } {
  // Papir <name> <gsm>g
  const gsmMatch = text.match(/(\d{2,4})\s*g(?:sm|\/m2|\/m²)?\b/i);
  const paper_gsm = gsmMatch ? Number(gsmMatch[1]) : null;

  // Papir: <name>
  let paper_type: string | null = null;
  const labelled = text.match(/papir(?:\s*(?:korice|strane|blok|omot))?\s*[:.]\s*([^\n\r,.]{2,60})/i);
  if (labelled) {
    paper_type = labelled[1].replace(/\s+\d{2,4}\s*g.*/i, "").trim();
  } else {
    const kw = text.match(/\b(kunzdruk|kunsdruk|kuncdruk|offset|munken|invercote|hromo(?:karton|lux)?|kraft|mat|sjaj|premaz|nepremaz)\b/i);
    if (kw) paper_type = kw[1];
  }
  return { paper_type: paper_type || null, paper_gsm };
}

function detectSheetFormat(widthMm: number | null, heightMm: number | null): "488x330" | "700x330" | null {
  if (!widthMm || !heightMm) return null;
  const max = Math.max(widthMm, heightMm);
  // Anything that fits within ~SRA3 goes on 488x330; A3+ full-bleed and up goes on 700x330
  if (max <= 330) return "488x330";
  if (max <= 488) return "488x330";
  if (max <= 700) return "700x330";
  return "700x330";
}

export function extractDigitalSpec(
  text: string,
  opts: {
    aiPages?: number | null;
    aiPrintSides?: string | null;
    aiPaperType?: string | null;
    aiPaperGsm?: number | null;
    aiSheetFormat?: string | null;
    widthMm?: number | null;
    heightMm?: number | null;
    aiFinishing?: string | null;
  } = {}
): DigitalSpec {
  const src = `${text ?? ""}\n${opts.aiFinishing ?? ""}`;
  const finishing = FINISHING_PATTERNS.reduce<Partial<DigitalSpec>>((acc, { key, rx }) => {
    if (rx.test(src)) (acc as any)[key] = true;
    return acc;
  }, {});
  const anyFinishing = Object.keys(finishing).length > 0;

  const paperFromText = extractPaper(src);
  const paper_type = opts.aiPaperType ?? paperFromText.paper_type;
  const paper_gsm = opts.aiPaperGsm ?? paperFromText.paper_gsm;

  const pages = opts.aiPages ?? extractPages(src);
  const print_sides = normalizePrintSides(opts.aiPrintSides || src);

  const sheet_format =
    opts.aiSheetFormat === "488x330" || opts.aiSheetFormat === "700x330"
      ? opts.aiSheetFormat
      : detectSheetFormat(opts.widthMm ?? null, opts.heightMm ?? null);

  return {
    pages,
    print_sides,
    paper_type,
    paper_gsm,
    sheet_format,
    sheet_finishing_enabled: anyFinishing,
    sheet_finishing_notes: opts.aiFinishing || null,
    sf_cutting: false, sf_creasing: false, sf_folding: false, sf_perforation: false,
    sf_hole_punching: false, sf_stapling: false, sf_spiral_binding: false,
    sf_thermal_binding: false, sf_thread_sewing: false, sf_hardcover: false,
    sf_softcover: false, sf_numbering: false, sf_block_gluing: false,
    sf_lamination: false, sf_uv_partial: false, sf_uv_full: false,
    sf_die_cutting: false, sf_grommets: false, sf_mounting: false, sf_gold_foil: false,
    ...finishing,
  };
}
