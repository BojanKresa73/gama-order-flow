import { useQuery } from "@tanstack/react-query";
import { supabaseGDC } from "@/integrations/supabase/gdc-client";

/**
 * Read-only mirror of GDC incoming invoices (nabavne fakture). Used by
 * MaterialsCostPanel to display latest supplier price per material.
 */
export interface GdcIncomingInvoice {
  id: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  total_eur?: number | null;
  [k: string]: any;
}

export interface GdcIncomingInvoiceItem {
  id: string;
  invoice_id?: string | null;
  material_id?: string | null;
  material_name?: string | null;
  qty?: number | null;
  unit?: string | null;
  unit_price_eur?: number | null;
  total_eur?: number | null;
  [k: string]: any;
}

export function useIncomingInvoicesGDC() {
  return useQuery({
    queryKey: ["gdc-incoming-invoices"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GdcIncomingInvoice[]> => {
      const { data, error } = await supabaseGDC
        .from("incoming_invoices")
        .select("*")
        .order("invoice_date", { ascending: false })
        .limit(500);
      if (error) {
        console.warn("[useIncomingInvoicesGDC] not available:", error.message);
        return [];
      }
      return (data as any[]) ?? [];
    },
  });
}

/**
 * Latest supplier price per material_id, derived from incoming_invoice_items
 * joined chronologically. Returns a Map keyed by GDC material_id.
 */
export function useLatestSupplierPricesGDC() {
  return useQuery({
    queryKey: ["gdc-incoming-invoice-items-latest"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, { price: number; date: string | null; supplier: string | null }>> => {
      const { data, error } = await supabaseGDC
        .from("incoming_invoice_items")
        .select("material_id, unit_price_eur, invoice_id")
        .limit(2000);
      if (error) {
        console.warn("[useLatestSupplierPricesGDC] not available:", error.message);
        return new Map();
      }

      const items = (data as any[]) ?? [];
      const invoiceIds = Array.from(
        new Set(items.map((i) => i.invoice_id).filter(Boolean))
      );
      let invoiceMap = new Map<string, { date: string | null; supplier: string | null }>();
      if (invoiceIds.length) {
        const { data: invs } = await supabaseGDC
          .from("incoming_invoices")
          .select("id, invoice_date, supplier_name")
          .in("id", invoiceIds);
        for (const inv of (invs as any[]) ?? []) {
          invoiceMap.set(inv.id, {
            date: inv.invoice_date ?? null,
            supplier: inv.supplier_name ?? null,
          });
        }
      }

      const latest = new Map<string, { price: number; date: string | null; supplier: string | null }>();
      for (const it of items) {
        if (!it.material_id || it.unit_price_eur == null) continue;
        const inv = invoiceMap.get(it.invoice_id) ?? { date: null, supplier: null };
        const prev = latest.get(it.material_id);
        if (!prev || (inv.date && (!prev.date || inv.date > prev.date))) {
          latest.set(it.material_id, {
            price: Number(it.unit_price_eur),
            date: inv.date,
            supplier: inv.supplier,
          });
        }
      }
      return latest;
    },
  });
}
