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

export async function parseTenderText(text: string): Promise<ParseTenderResult> {
  const { data, error } = await supabase.functions.invoke("parse-tender-text", {
    body: { text },
  });
  if (error) throw error;
  return (data ?? { items: [] }) as ParseTenderResult;
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
      item_type: it.item_type,
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
