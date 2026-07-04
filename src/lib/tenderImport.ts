// Client-side helper that turns raw tender / email text into a draft quote by
// calling the `parse-tender-text` edge function and creating rows in `quotes`
// + `quote_items`. Used by the Quotes-Pro import dialog.

import { supabase } from "@/integrations/supabase/client";

export interface ParsedTenderItem {
  name: string;
  description?: string | null;
  quantity: number;
  width_mm?: number | null;
  height_mm?: number | null;
  item_type: "digital" | "large_format" | "other";
  material_id?: string | null;
  material_name?: string | null;
  unit_price?: number | null;
  notes?: string | null;
}

export interface ParseTenderResult {
  items: ParsedTenderItem[];
  client_hint?: string | null;
  raw_notes?: string | null;
}

/** Raw shape returned by the parse-tender-text edge function. */
interface EdgeRow {
  code?: string;
  productName?: string;
  category?: string;
  rawDescription?: string;
  material?: string | null;
  printSides?: string | null;
  finishing?: string | null;
  format?: string | null;
  minQtyPerOrder?: number | null;
  uom?: "m2" | "pcs";
  yearlyQty?: number;
  monthlyQty?: number | null;
  perStoreQty?: number | null;
  comment?: string | null;
  matchedMaterialId?: string | null;
  matchedMaterialName?: string | null;
  productType?: "digital" | "large_format";
  paperType?: string | null;
  paperGsm?: number | null;
  pages?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  sheetFormat?: string | null;
}

function buildDescription(r: EdgeRow): string {
  const parts: string[] = [];
  if (r.rawDescription && r.rawDescription.trim()) parts.push(r.rawDescription.trim());
  const meta: string[] = [];
  if (r.format) meta.push(`Format: ${r.format}`);
  if (r.widthMm && r.heightMm) meta.push(`Dim: ${r.widthMm}×${r.heightMm} mm`);
  if (r.pages) meta.push(`Strana: ${r.pages}`);
  if (r.paperType || r.paperGsm) {
    meta.push(`Papir: ${[r.paperType, r.paperGsm ? `${r.paperGsm}g` : null].filter(Boolean).join(" ")}`);
  }
  if (r.printSides) meta.push(`Štampa: ${r.printSides}`);
  if (r.finishing) meta.push(`Dorada: ${r.finishing}`);
  if (r.material && !r.matchedMaterialName) meta.push(`Materijal: ${r.material}`);
  if (meta.length) parts.push(meta.join(" • "));
  return parts.join("\n");
}

export async function parseTenderText(text: string): Promise<ParseTenderResult> {
  // Load material catalog so the AI can match names.
  let materials: { id: string; name: string; category?: string }[] = [];
  try {
    const { data } = await supabase
      .from("materials" as any)
      .select("id, name, category")
      .limit(500);
    if (Array.isArray(data)) materials = data as any;
  } catch {
    // materials table optional
  }

  const { data, error } = await supabase.functions.invoke("parse-tender-text", {
    body: { text, materials },
  });
  if (error) throw error;

  const rows: EdgeRow[] = Array.isArray((data as any)?.rows)
    ? (data as any).rows
    : Array.isArray((data as any)?.items)
    ? (data as any).items
    : [];

  const items: ParsedTenderItem[] = rows.map((r) => {
    const item_type: ParsedTenderItem["item_type"] =
      r.productType === "digital" ? "digital"
      : r.productType === "large_format" ? "large_format"
      : "other";
    const qty = typeof r.yearlyQty === "number" && r.yearlyQty > 0 ? r.yearlyQty : 1;
    const name = r.productName?.trim() || r.category?.trim() || "Stavka";
    return {
      name,
      description: buildDescription(r) || null,
      quantity: qty,
      width_mm: r.widthMm ?? null,
      height_mm: r.heightMm ?? null,
      item_type,
      material_id: r.matchedMaterialId ?? null,
      material_name: r.matchedMaterialName ?? r.material ?? null,
      unit_price: 0,
      notes: r.comment ?? null,
    };
  });

  return { items, client_hint: (data as any)?.client_hint ?? null, raw_notes: null };
}

export interface CreateQuoteFromTenderInput {
  clientId: string;
  parsed: ParseTenderResult;
  notes?: string;
}

/** Create a draft quote + items from parsed tender output. Returns the new quote id. */
export async function createQuoteFromTender(
  input: CreateQuoteFromTenderInput
): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user?.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: quote, error: qErr } = await supabase
    .from("quotes" as any)
    .insert({
      client_id: input.clientId,
      status: "draft",
      created_by: uid,
      notes: input.notes ?? input.parsed.raw_notes ?? null,
    })
    .select("id")
    .single();
  if (qErr) throw qErr;

  const quoteId = (quote as any).id as string;

  if (input.parsed.items.length) {
    const rows = input.parsed.items.map((it, idx) => ({
      quote_id: quoteId,
      item_type: it.item_type === "other" ? "razno" : it.item_type,
      name: it.name,
      description: it.description ?? null,
      quantity: it.quantity ?? 1,
      width_mm: it.width_mm ?? null,
      height_mm: it.height_mm ?? null,
      material_id: it.material_id ?? null,
      material_name: it.material_name ?? null,
      unit_price: it.unit_price ?? 0,
      line_total: (it.unit_price ?? 0) * (it.quantity ?? 1),
      order_index: idx,
    }));
    const { error: iErr } = await supabase.from("quote_items" as any).insert(rows);
    if (iErr) throw iErr;
  }

  return quoteId;
}
