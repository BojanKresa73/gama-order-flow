// Legacy wrapper used by "New quote from pasted text" flow
// (`src/components/quotes-pro/TenderImportDialog.tsx`).
// The primary import path is `ImportTenderDialog` — this file just lets a
// user quickly bootstrap a fresh quote from raw text before opening the full
// editor. It intentionally does the minimum: call the AI edge function,
// create a draft quote, insert lightweight rows. All heavy lifting
// (pricing, materijali, digital tarifa, few-shot) živi u `ImportTenderDialog`.

import { supabase } from "@/integrations/supabase/client";

export interface QuickParsedItem {
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
  items: QuickParsedItem[];
  client_hint?: string | null;
  raw_notes?: string | null;
}

interface EdgeRow {
  code?: string;
  productName?: string;
  category?: string;
  rawDescription?: string;
  material?: string | null;
  finishing?: string | null;
  format?: string | null;
  yearlyQty?: number;
  matchedMaterialId?: string | null;
  matchedMaterialName?: string | null;
  productType?: "digital" | "large_format";
  widthMm?: number | null;
  heightMm?: number | null;
}

export async function parseTenderText(text: string): Promise<ParseTenderResult> {
  let materials: { id: string; name: string; category?: string }[] = [];
  try {
    const { data } = await supabase
      .from("materials" as any)
      .select("id, name, category")
      .limit(500);
    if (Array.isArray(data)) materials = data as any;
  } catch {
    // materials tabela je opciona
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

  const items: QuickParsedItem[] = rows.map((r) => {
    const parts: string[] = [];
    if (r.rawDescription?.trim()) parts.push(r.rawDescription.trim());
    const meta: string[] = [];
    if (r.format) meta.push(`Format: ${r.format}`);
    if (r.widthMm && r.heightMm) meta.push(`Dim: ${r.widthMm}×${r.heightMm} mm`);
    if (r.finishing) meta.push(`Dorada: ${r.finishing}`);
    if (r.material && !r.matchedMaterialName) meta.push(`Materijal: ${r.material}`);
    if (meta.length) parts.push(meta.join(" • "));

    return {
      name: r.productName?.trim() || r.category?.trim() || "Stavka",
      description: parts.join("\n") || null,
      quantity: typeof r.yearlyQty === "number" && r.yearlyQty > 0 ? r.yearlyQty : 1,
      width_mm: r.widthMm ?? null,
      height_mm: r.heightMm ?? null,
      item_type:
        r.productType === "digital"
          ? "digital"
          : r.productType === "large_format"
          ? "large_format"
          : "other",
      material_id: r.matchedMaterialId ?? null,
      material_name: r.matchedMaterialName ?? r.material ?? null,
      unit_price: 0,
      notes: null,
    };
  });

  return { items, client_hint: (data as any)?.client_hint ?? null, raw_notes: null };
}

export interface CreateQuoteFromTenderInput {
  clientId: string;
  parsed: ParseTenderResult;
  notes?: string;
}

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
