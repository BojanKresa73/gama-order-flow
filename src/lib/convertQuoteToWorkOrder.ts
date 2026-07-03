import { supabase } from "@/integrations/supabase/client";
import type { Quote, QuoteItem } from "@/hooks/useQuotesPro";
import { EUR_TO_RSD } from "@/lib/quotePricing";

/** Build compact description of an item for the operator (no prices, only tech spec). */
function buildItemDescription(item: QuoteItem): string {
  const parts: string[] = [];
  if (item.width_mm && item.height_mm) {
    parts.push(`${(item.width_mm / 10).toFixed(1)} × ${(item.height_mm / 10).toFixed(1)} cm`);
  }
  if (item.area_m2) parts.push(`P: ${Number(item.area_m2).toFixed(3)} m²`);
  if (item.material_name) parts.push(`Materijal: ${item.material_name}`);
  if (item.paper_type) parts.push(`Papir: ${item.paper_type}${item.paper_gsm ? ` ${item.paper_gsm}g` : ""}`);
  if (item.print_sides) parts.push(`Štampa: ${item.print_sides}`);
  if (item.pages) parts.push(`Str: ${item.pages}`);
  const fins: string[] = [];
  if (item.finishing_lamination) fins.push("laminacija");
  if (item.finishing_cutting) fins.push("sečenje");
  if (item.finishing_creasing) fins.push("ricovanje");
  if (item.finishing_grommets) fins.push("ringle");
  if (item.finishing_weld_edges) fins.push("zavarivanje");
  if (item.finishing_sleeve) fins.push("tunel");
  if (item.finishing_joining) fins.push("spajanje");
  if (item.finishing_ruter) fins.push("ruter");
  if (item.finishing_v_cut) fins.push("V-cut");
  if (item.finishing_kasiranje) fins.push("kaširanje");
  if (item.finishing_lepljenje) fins.push("lepljenje");
  if (fins.length) parts.push(`Dorada: ${fins.join(", ")}`);
  if (item.finishing_notes) parts.push(`Napomena: ${item.finishing_notes}`);
  if (item.description) parts.push(item.description);
  return parts.join(" | ");
}

/**
 * Create an OSTALO work order from a quote and link them bidirectionally.
 * Returns the new work order id.
 */
export async function convertQuoteToWorkOrder(quote: Quote): Promise<string> {
  if (!quote.items || quote.items.length === 0) {
    throw new Error("Ponuda nema stavki za konverziju");
  }

  // Compose a rich notes block that gives the operator all specs (no prices).
  const lines: string[] = [`=== Iz ponude ${quote.quote_number} ===`];
  quote.items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.name} × ${it.quantity}`);
    const desc = buildItemDescription(it);
    if (desc) lines.push(`   ${desc}`);
    const inst = Number((it as any).installation_cost || 0);
    if (inst > 0) lines.push(`   Montaža uključena`);
  });
  const terrainCount = Number((quote as any).terrain_visits_count || 0);
  if (terrainCount > 0) lines.push(`Izlazak na teren ×${terrainCount}`);
  if (quote.notes) lines.push(`\nNapomena za klijenta: ${quote.notes}`);
  if (quote.internal_notes) lines.push(`\nInterna napomena: ${quote.internal_notes}`);
  if (quote.payment_terms) lines.push(`\nPlaćanje: ${quote.payment_terms}`);
  const notes = lines.join("\n");

  const jobName = `Iz ponude ${quote.quote_number}${quote.client?.name ? " — " + quote.client.name : ""}`;

  const { data, error } = await supabase.functions.invoke("create-work-order", {
    body: {
      client_id: quote.client_id,
      type: "OSTALO",
      order_type: "misc",
      kind: "RAZNO",
      job_name: jobName,
      notes,
      run_quantity: quote.items.reduce((s, it) => s + Number(it.quantity || 0), 0) || 1,
    },
  });

  if (error) throw new Error(error.message || "Greška pri kreiranju radnog naloga");
  const workOrderId = (data?.data?.id ?? data?.id) as string | undefined;
  if (!workOrderId) throw new Error(data?.error || "Edge funkcija nije vratila ID naloga");

  // Link back
  const { error: linkErr } = await supabase
    .from("work_orders")
    .update({ quote_id: quote.id } as any)
    .eq("id", workOrderId);
  if (linkErr) console.error("Failed to link work_orders.quote_id:", linkErr);

  const { error: qErr } = await supabase
    .from("quotes")
    .update({ status: "accepted", work_order_id: workOrderId } as any)
    .eq("id", quote.id);
  if (qErr) console.error("Failed to update quote after WO creation:", qErr);

  // Silence unused warning
  void EUR_TO_RSD;

  return workOrderId;
}
