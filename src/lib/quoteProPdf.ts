// Adapter: build a QuoteData payload for the shared Gama memorandum PDF
// generator (`generateQuotePdf`) from a Quotes-Pro `Quote` + its items.

import { generateQuotePdf, type QuoteData, type QuoteItemPdf, type QuoteSigner } from "./quotePdf";
import type { Quote, QuoteItem } from "@/hooks/useQuotesPro";

function itemToPdf(it: QuoteItem): QuoteItemPdf {
  return {
    materialName: it.name + (it.material_name ? ` — ${it.material_name}` : ""),
    widthCm: it.width_mm ? Number(it.width_mm) / 10 : 0,
    heightCm: it.height_mm ? Number(it.height_mm) / 10 : 0,
    qty: Number(it.quantity ?? 0),
    printSides: it.print_sides ?? "",
    unitPrice: Number(it.unit_price ?? 0),
    lineTotal: Number(it.line_total ?? 0),
  };
}

export async function generateQuoteProPdf(
  quote: Quote,
  items: QuoteItem[],
  signer: QuoteSigner
): Promise<Uint8Array> {
  const data: QuoteData = {
    quoteNumber: quote.quote_number ?? "PON",
    date: new Date(quote.created_at ?? Date.now()),
    clientName: quote.client?.name ?? "—",
    clientCompany: quote.client?.name ?? undefined,
    clientEmail: quote.client?.email ?? undefined,
    clientPib: quote.client?.pib ?? undefined,
    clientAddress:
      [quote.client?.adresa, quote.client?.grad].filter(Boolean).join(", ") || undefined,
    notes: quote.notes ?? undefined,
    items: items.map(itemToPdf),
    total: Number(quote.final_price ?? quote.total_price ?? 0),
    signer,
  };
  return generateQuotePdf(data);
}
