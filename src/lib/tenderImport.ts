// Source of truth: GDC Order — src/lib/tenderImport.ts
// This module is a 1:1 port. Local "improvements" that diverge from GDC
// should NOT be added here — fix GDC first, then re-sync.

import * as XLSX from "xlsx";
import Fuse from "fuse.js";
import { defaultTonerCostEur } from "@/lib/quotePricing";

export interface ParsedTenderRow {
  rowIndex: number;
  code: string;
  productName?: string;
  category: string;
  rawDescription: string;
  // Extracted
  material: string | null;
  printSides: string | null;
  finishing: string | null;
  format: string | null;
  // UOM data from Excel
  minQtyPerOrder: number | null;
  uom: string; // "m2" or "pcs"
  yearlyQty: number;
  monthlyQty: number | null;
  perStoreQty: number | null;
  comment: string | null;
  // Classification (AI)
  productType?: "digital" | "large_format";
  paperType?: string | null;
  paperGsm?: number | null;
  pages?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  sheetFormat?: "488x330" | "700x330" | null;
  // Mapping (filled by user/auto)
  matchedMaterialId: string | null;
  matchedMaterialName: string | null;
  costPerUnit: number; // EUR per m² or per pcs (material only)
  tonerCostPerM2Eur: number; // EUR per m² for ink
  finishingCost: number; // EUR per UOM
  markupPercent: number;
  customUnitPrice: number | null;
  // Computed
  unitPrice: number;
  lineTotal: number;
}

interface MaterialOption {
  id: string;
  name: string;
  category: string;
}

export function extractMaterial(text: string): string | null {
  const m = text.match(/(?:Materijal|Papir)\s*:\s*([^\n\r]+)/i);
  if (m) return m[1].trim().replace(/\s+/g, " ");
  const kw = text.match(/\b(lepenk\w*|talasast\w*|karton|forex|kapa\s*ploca|kapaploca|plexi\w*|pleksi\w*|alubond|aluminij\w*|samolepljiv\w*|nalepnic\w*|cerad\w*|baner|banner|mesh|one\s*way|roll\s*up|pvc[^,\n]*)/i);
  return kw ? kw[0].replace(/\s+/g, " ").trim() : null;
}

export function extractPrintSides(text: string): string | null {
  const m = text.match(/\b([14])\s*[\/+]\s*([0-4])\b/);
  if (m) return `${m[1]}/${m[2]}`;
  const labelled = text.match(/(?:Štampa|Stampa)\s*:\s*([^\n,]+)/i);
  if (labelled) {
    const sides = labelled[1].match(/[14]\/[0-4]/);
    if (sides) return sides[0];
    return labelled[1].trim();
  }
  return null;
}

export function normalizePrintSides(value: string | null | undefined, fallback: string = "4/0"): string {
  if (!value) return fallback;
  const m = String(value).match(/\b([14])\s*[\/+]+\s*([0-4])\b/);
  if (m) return `${m[1]}/${m[2]}`;
  const normalized = norm(String(value));
  if (/obostr|duplex|dvostran/.test(normalized)) return "4/4";
  if (/jednostr|simplex/.test(normalized)) return "4/0";
  return fallback;
}

export function extractFinishing(text: string): string | null {
  const m = text.match(/(?:Način dorade|Nacin dorade|Dorada)\s*:\s*([^\n\r]+)/i);
  if (m) return m[1].trim();
  const kw = text.match(/\b(plastifikacij\w*|biguj\w*|biguje|stancan\w*|stanc\w*|sečen\w*|secen\w*|kasiran\w*|lakir\w*|UV\s*lak|perforacij\w*|savijan\w*)/i);
  return kw ? kw[0].trim() : null;
}

export function extractFormat(text: string): string | null {
  const dims = extractDimensionsMm(text);
  if (dims) return `${dims.widthMm}×${dims.heightMm} mm`;
  const m = text.match(/Format[^:]*:\s*([^\n\r]+)/i);
  return m ? m[1].trim() : null;
}

export function extractDimensionsMm(text: string): { widthMm: number; heightMm: number } | null {
  if (!text) return null;
  const unitToMm = (n: number, unit: string | undefined) => {
    const u = (unit || "").toLowerCase();
    if (u === "cm") return n * 10;
    if (u === "m") return n * 1000;
    return n;
  };

  const labelled = text.match(/(?:Dimenzij\w*|Format|Velicin\w*|Veličin\w*)\s*:\s*([^\n\r]+)/i);
  const sources = [labelled?.[1] || "", text];

  for (const src of sources) {
    if (!src) continue;
    const m = src.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\b/i);
    if (m) {
      const w = Number(m[1].replace(",", "."));
      const h = Number(m[2].replace(",", "."));
      if (w > 0 && h > 0) {
        const unit = m[3] || (w < 50 && h < 50 ? "cm" : "mm");
        return {
          widthMm: Math.round(unitToMm(w, unit)),
          heightMm: Math.round(unitToMm(h, unit)),
        };
      }
    }
  }

  const diam = text.match(/(?:pre[čc]nik|dijametar|diameter|\bfi\b|[ØøΦϕ⌀])\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i);
  if (diam) {
    const d = Number(diam[1].replace(",", "."));
    if (d > 0) {
      const unit = diam[2] || (d < 50 ? "cm" : "mm");
      const mm = Math.round(unitToMm(d, unit));
      return { widthMm: mm, heightMm: mm };
    }
  }

  const a = text.match(/\bA([0-6])\b/);
  if (a) {
    const sizes: Record<string, [number, number]> = {
      "0": [841, 1189], "1": [594, 841], "2": [420, 594],
      "3": [297, 420], "4": [210, 297], "5": [148, 210], "6": [105, 148],
    };
    const [w, h] = sizes[a[1]];
    return { widthMm: w, heightMm: h };
  }
  const b = text.match(/\bB([0-5])\b/);
  if (b) {
    const sizes: Record<string, [number, number]> = {
      "0": [1000, 1400], "1": [700, 1000], "2": [500, 700],
      "3": [350, 500], "4": [250, 350], "5": [176, 250],
    };
    const [w, h] = sizes[b[1]];
    return { widthMm: w, heightMm: h };
  }
  return null;
}

export function extractQuantity(text: string): number | null {
  const m = text.match(/(?:Količina|Kolicina|Tiraž|Tiraz|Komada)\s*:?\s*(\d{1,7})/i);
  if (m) return Number(m[1]);
  const k = text.match(/\b(\d{1,6})\s*(?:kom|komada|kos|pcs)\b/i);
  return k ? Number(k[1]) : null;
}

export function parseTenderWorkbook(file: ArrayBuffer): ParsedTenderRow[] {
  const wb = XLSX.read(file, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const out: ParsedTenderRow[] = [];
  let currentCategory = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const code = row[0] != null ? String(row[0]).trim() : "";
    const desc = row[1] != null ? String(row[1]).trim() : "";
    if (!code || !desc) continue;

    if (/^\d+$/.test(code)) {
      currentCategory = desc;
      continue;
    }
    if (!/^\d+\.\d+/.test(code)) continue;

    const minQty = parseNum(row[2]);
    const uom = row[3] != null ? String(row[3]).trim().toLowerCase() : "pcs";
    const yearly = parseNum(row[4]) ?? 0;
    const monthly = parseNum(row[5]);
    const perStore = parseNum(row[6]);
    const comment = row[7] != null ? String(row[7]).trim() : null;
    const material = extractMaterial(desc);

    out.push({
      rowIndex: i,
      code,
      category: currentCategory || extractCategoryFromDesc(desc),
      rawDescription: desc,
      material,
      printSides: extractPrintSides(desc),
      finishing: extractFinishing(desc),
      format: extractFormat(desc),
      minQtyPerOrder: minQty,
      uom: uom === "m2" || uom === "m²" ? "m2" : "pcs",
      yearlyQty: yearly,
      monthlyQty: monthly,
      perStoreQty: perStore,
      comment,
      matchedMaterialId: null,
      matchedMaterialName: null,
      costPerUnit: 0,
      tonerCostPerM2Eur: defaultTonerCostEur(material || desc),
      finishingCost: 0,
      markupPercent: 300,
      customUnitPrice: null,
      unitPrice: 0,
      lineTotal: 0,
    });
  }

  return out;
}

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(",", ".").replace(/\s/g, "");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function extractCategoryFromDesc(desc: string): string {
  const first = desc.split(/[\n\r]/)[0];
  return first.length > 60 ? first.slice(0, 60) : first;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/č|ć/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "dj")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYMS: Array<{ test: RegExp; expand: string[] }> = [
  { test: /lepenk|talasast|karton/, expand: ["karton", "kapa ploca", "kapaploca", "forex", "kapa"] },
  { test: /samolepl|nalepnic|sticker/, expand: ["pvc samolepljiva", "samolepljiva folija", "folija"] },
  { test: /cerad|tarpaulin|baner|banner/, expand: ["cerada", "baner", "frontlit", "pvc cerada"] },
  { test: /mesh|mreza/, expand: ["mesh", "mreza"] },
  { test: /plexi|pleksi|akril/, expand: ["plexiglass", "pleksiglas", "akril"] },
  { test: /forex|pvc.*pen|penasti pvc/, expand: ["forex", "pvc penasti"] },
  { test: /kapa.*ploc|kapaploc/, expand: ["kapa ploca", "kapaploca"] },
  { test: /alubond|aludibon|aluminij/, expand: ["alubond", "aluminijum"] },
  { test: /one ?way|jednosmer/, expand: ["one way vision", "perforirana folija"] },
  { test: /roll ?up|rolap/, expand: ["roll up", "banner"] },
];

function expandSynonyms(text: string): string[] {
  const out: string[] = [];
  for (const { test, expand } of SYNONYMS) {
    if (test.test(text)) out.push(...expand);
  }
  return out;
}

export function autoMatchMaterials(
  rows: ParsedTenderRow[],
  catalog: MaterialOption[]
): ParsedTenderRow[] {
  const enriched = catalog.map((m) => ({ ...m, _norm: norm(`${m.name} ${m.category}`) }));
  const fuse = new Fuse(enriched, {
    keys: ["_norm", "name", "category"],
    threshold: 0.5,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });

  return rows.map((row) => {
    const candidates: string[] = [];
    if (row.material) candidates.push(norm(row.material));
    const normDesc = norm(row.rawDescription);
    candidates.push(normDesc.slice(0, 120));
    candidates.push(...expandSynonyms(normDesc));
    if (row.material) candidates.push(...expandSynonyms(norm(row.material)));

    for (const q of candidates) {
      if (!q) continue;
      const results = fuse.search(q);
      if (results.length > 0 && (results[0].score ?? 1) < 0.55) {
        return {
          ...row,
          matchedMaterialId: results[0].item.id,
          matchedMaterialName: results[0].item.name,
        };
      }
    }
    return row;
  });
}

export function recomputeRow(row: ParsedTenderRow): ParsedTenderRow {
  if (row.productType === "digital") {
    const unitPrice = row.customUnitPrice ?? (row.costPerUnit * (1 + (row.markupPercent || 0) / 100));
    return { ...row, unitPrice, lineTotal: unitPrice * (row.yearlyQty || 0) };
  }
  const areaM2 = row.uom === "m2" ? (row.minQtyPerOrder ?? 1) : 1;
  const materialCost = row.uom === "m2" ? row.costPerUnit * areaM2 : row.costPerUnit;
  const tonerCost = row.uom === "m2" ? (row.tonerCostPerM2Eur || 0) * areaM2 : 0;
  const baseCost = materialCost + tonerCost + (row.finishingCost || 0);
  const calculated = baseCost * (1 + (row.markupPercent || 0) / 100);
  const unitPrice = row.customUnitPrice ?? calculated;
  const lineTotal = unitPrice * (row.yearlyQty || 0);
  return { ...row, unitPrice, lineTotal };
}
