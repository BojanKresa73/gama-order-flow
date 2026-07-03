import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  computeLargeFormatPricing,
  computeInstallationCostEur,
  deriveStoredTonerCostPerM2Eur,
  EUR_TO_RSD,
} from "@/lib/quotePricing";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "superseded";

export type QuoteQuickFilter =
  | "all" | "mine" | "expiring_soon" | "stale_sent" | "high_value" | "this_month";

export interface Quote {
  id: string;
  quote_number: string;
  job_name: string | null;
  client_id: string;
  status: QuoteStatus;
  total_price: number;
  discount_percent: number;
  final_price: number;
  valid_days: number;
  expires_at: string | null;
  sent_at: string | null;
  parent_quote_id: string | null;
  revision_number: number;
  payment_terms: string | null;
  delivery_days: number | null;
  notes: string | null;
  internal_notes: string | null;
  default_markup_percent: number;
  exchange_rate_used?: number;
  terrain_visits_count?: number;
  terrain_visit_price_eur?: number;
  terrain_visits_cost?: number;
  install_address?: string | null;
  install_date?: string | null;
  install_time?: string | null;
  install_contact?: string | null;
  install_phone?: string | null;
  install_notes?: string | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  delivery_contact?: string | null;
  delivery_phone?: string | null;
  delivery_notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  work_order_id?: string | null;

  client?: {
    id: string;
    name: string;
    email: string | null;
    pib: string | null;
    adresa?: string | null;
    grad?: string | null;
    telefon?: string | null;
  };
  creator?: { id: string; full_name: string | null };
  items?: QuoteItem[];
}

export type QuoteItemType = "digital" | "large_format" | "service" | "razno";

export interface QuoteItem {
  id: string;
  quote_id: string;
  item_type: QuoteItemType;
  name: string;
  description: string | null;
  quantity: number;
  width_mm: number | null;
  height_mm: number | null;
  pages: number | null;
  print_sides: string | null;
  paper_type: string | null;
  paper_gsm: number | null;
  sheet_format: string | null;
  material_id: string | null;
  material_name: string | null;
  area_m2: number | null;
  service_id: string | null;
  service_name: string | null;
  unit_cost: number;
  unit_price: number;
  custom_price: number | null;
  line_total: number;
  supplier_name: string | null;
  supplier_price: number | null;
  cost_per_m2: number | null;
  finishing_cost: number;
  markup_percent: number | null;
  source_category: string | null;
  min_qty_per_order: number | null;
  yearly_qty: number | null;
  order_index: number;
  toner_cost_per_m2_eur?: number | null;
  installation_standard_enabled?: boolean;
  installation_price_per_m2?: number;
  installation_fixed_start?: number;
  installation_high_enabled?: boolean;
  installation_high_price_per_m2?: number;
  installation_high_fixed_start?: number;
  installation_cost?: number;
  finishing_enabled?: boolean;
  finishing_grommets?: boolean;
  finishing_weld_edges?: boolean;
  finishing_sleeve?: boolean;
  finishing_joining?: boolean;
  finishing_lamination?: boolean;
  finishing_cutting?: boolean;
  finishing_creasing?: boolean;
  finishing_ruter?: boolean;
  finishing_v_cut?: boolean;
  finishing_kasiranje?: boolean;
  finishing_lepljenje?: boolean;
  finishing_notes?: string | null;
  sheet_finishing_enabled?: boolean;
  sf_cutting?: boolean;
  sf_creasing?: boolean;
  sf_folding?: boolean;
  sf_perforation?: boolean;
  sf_hole_punching?: boolean;
  sf_stapling?: boolean;
  sf_spiral_binding?: boolean;
  sf_thermal_binding?: boolean;
  sf_thread_sewing?: boolean;
  sf_hardcover?: boolean;
  sf_softcover?: boolean;
  sf_numbering?: boolean;
  sf_block_gluing?: boolean;
  sf_lamination?: boolean;
  sf_uv_partial?: boolean;
  sf_uv_full?: boolean;
  sf_die_cutting?: boolean;
  sf_grommets?: boolean;
  sf_mounting?: boolean;
  sf_gold_foil?: boolean;
  sheet_finishing_notes?: string | null;
  digital_spec?: any | null;
  billable_qty?: number | null;
  billable_unit?: string | null;
  created_at: string;
  updated_at: string;
}

export type QuoteSortBy =
  | "newest" | "oldest" | "value_desc" | "value_asc" | "expiring_soon" | "client_name";

export interface QuoteFilters {
  search?: string;
  status?: QuoteStatus | "all";
  clientId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  quickFilter?: QuoteQuickFilter;
  sortBy?: QuoteSortBy;
  minValueEur?: number;
}


export function useQuotesPro(filters?: QuoteFilters) {
  return useQuery({
    queryKey: ["quotes-pro", filters],
    queryFn: async () => {
      let query = supabase
        .from("quotes")
        .select(`
          *,
          client:clients!client_id(id, name, email, pib),
          creator:profiles!created_by(id, full_name)
        `);

      const sortBy = filters?.sortBy ?? "newest";
      if (sortBy === "newest") query = query.order("created_at", { ascending: false });
      else if (sortBy === "oldest") query = query.order("created_at", { ascending: true });
      else if (sortBy === "value_desc") query = query.order("final_price", { ascending: false, nullsFirst: false });
      else if (sortBy === "value_asc") query = query.order("final_price", { ascending: true, nullsFirst: false });
      else if (sortBy === "expiring_soon") query = query.order("expires_at", { ascending: true, nullsFirst: false });
      else if (sortBy === "client_name") query = query.order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.clientId) query = query.eq("client_id", filters.clientId);
      if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom.toISOString());
      if (filters?.dateTo) query = query.lte("created_at", filters.dateTo.toISOString());
      if (typeof filters?.minValueEur === "number" && filters.minValueEur > 0) {
        query = query.gte("final_price", filters.minValueEur * EUR_TO_RSD);
      }

      const qf = filters?.quickFilter ?? "all";
      const now = new Date();
      if (qf === "mine") {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) query = query.eq("created_by", u.user.id);
      } else if (qf === "expiring_soon") {
        const in3 = new Date(now.getTime() + 3 * 86400000).toISOString();
        query = query.eq("status", "sent").gte("expires_at", now.toISOString()).lte("expires_at", in3);
      } else if (qf === "stale_sent") {
        const sevenAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
        query = query.eq("status", "sent").lte("sent_at", sevenAgo);
      } else if (qf === "high_value") {
        query = query.gte("final_price", 1000 * EUR_TO_RSD);
      } else if (qf === "this_month") {
        const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte("created_at", first);
      }

      const { data, error } = await query;
      if (error) throw error;
      let quotes = data as unknown as Quote[];

      if (filters?.search) {
        const s = filters.search.toLowerCase();
        quotes = quotes.filter(
          (q) =>
            q.quote_number.toLowerCase().includes(s) ||
            q.job_name?.toLowerCase().includes(s) ||
            q.client?.name.toLowerCase().includes(s) ||
            q.notes?.toLowerCase().includes(s)
        );
      }
      if (sortBy === "client_name") {
        quotes = [...quotes].sort((a, b) =>
          (a.client?.name ?? "").localeCompare(b.client?.name ?? "", "sr"),
        );
      }
      return quotes;
    },
  });
}


export function useDuplicateQuotePro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, asNewVersion }: { quoteId: string; asNewVersion?: boolean }) => {
      const { data, error } = await supabase.rpc("duplicate_quote" as any, {
        p_quote_id: quoteId,
        p_as_new_version: asNewVersion ?? false,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_id, vars) => {
      queryClient.invalidateQueries({ queryKey: ["quotes-pro"] });
      queryClient.invalidateQueries({ queryKey: ["quote-versions"] });
      toast.success(vars.asNewVersion ? "Kreirana nova verzija" : "Ponuda duplirana");
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useQuotePro(id: string | undefined) {
  return useQuery({
    queryKey: ["quote-pro", id],
    queryFn: async () => {
      if (!id) return null;
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select(`
          *,
          client:clients!client_id(id, name, email, pib, adresa, grad, telefon),
          creator:profiles!created_by(id, full_name)
        `)
        .eq("id", id)
        .single();
      if (quoteError) throw quoteError;

      const { data: items, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", id)
        .order("order_index");
      if (itemsError) throw itemsError;

      return {
        ...(quote as unknown as Quote),
        items: items as unknown as QuoteItem[],
      };
    },
    enabled: !!id,
  });
}

export function useCreateQuotePro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      client_id: string;
      job_name?: string;
      payment_terms?: string;
      delivery_days?: number;
      notes?: string;
      internal_notes?: string;
      valid_days?: number;
      default_markup_percent?: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Niste prijavljeni");
      const insertData = {
        client_id: data.client_id,
        job_name: data.job_name?.trim() || null,
        payment_terms: data.payment_terms || null,
        delivery_days: data.delivery_days || null,
        notes: data.notes || null,
        internal_notes: data.internal_notes || null,
        valid_days: data.valid_days || 14,
        default_markup_percent: data.default_markup_percent ?? 300,
        created_by: user.user.id,
      };
      const { data: quote, error } = await supabase
        .from("quotes")
        .insert(insertData as any)
        .select()
        .single();
      if (error) throw error;
      return quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes-pro"] });
      toast.success("Ponuda kreirana");
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useUpdateQuotePro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Quote>) => {
      const { error } = await supabase.from("quotes").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotes-pro"] });
      queryClient.invalidateQueries({ queryKey: ["quote-pro", variables.id] });
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useDeleteQuotePro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes-pro"] });
      toast.success("Ponuda obrisana");
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useAddQuoteItemPro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<QuoteItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("quote_items")
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quote-pro", variables.quote_id] });
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useUpdateQuoteItemPro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, quote_id, ...data
    }: Partial<QuoteItem> & { id: string; quote_id: string }) => {
      const { error } = await supabase.from("quote_items").update(data as any).eq("id", id);
      if (error) throw error;
      return quote_id;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["quote-pro", quoteId] });
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useDeleteQuoteItemPro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quote_id }: { id: string; quote_id: string }) => {
      const { error } = await supabase.from("quote_items").delete().eq("id", id);
      if (error) throw error;
      return quote_id;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["quote-pro", quoteId] });
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useRecalculateQuoteTotalsPro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data: items, error: itemsError } = await supabase
        .from("quote_items").select("line_total").eq("quote_id", quoteId);
      if (itemsError) throw itemsError;

      const total = (items || []).reduce((sum, item) => sum + Number(item.line_total || 0), 0);

      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("discount_percent, terrain_visits_count, terrain_visit_price_eur")
        .eq("id", quoteId)
        .single();
      if (quoteError) throw quoteError;

      const discount = Number(quote.discount_percent || 0);
      const terrainCount = Number((quote as any).terrain_visits_count || 0);
      const terrainPriceEur = Number((quote as any).terrain_visit_price_eur || 0);
      const terrainCost = terrainCount * terrainPriceEur * EUR_TO_RSD;
      const finalPrice = total * (1 - discount / 100) + terrainCost;

      const { error: updateError } = await supabase
        .from("quotes")
        .update({
          total_price: total,
          final_price: finalPrice,
          terrain_visits_cost: terrainCost,
        } as any)
        .eq("id", quoteId);
      if (updateError) throw updateError;
      return { total, finalPrice };
    },
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["quote-pro", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes-pro"] });
    },
  });
}

export function useBulkInsertQuoteItemsPro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quoteId, items,
    }: {
      quoteId: string;
      items: Array<Omit<QuoteItem, "id" | "created_at" | "updated_at">>;
    }) => {
      const { error } = await supabase.from("quote_items").insert(items as any);
      if (error) throw error;
      return quoteId;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["quote-pro", quoteId] });
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useUpdateMaterialCostInQuotePro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quoteId, materialId, newCostPerM2, defaultMarkupPercent,
    }: {
      quoteId: string;
      materialId: string;
      newCostPerM2: number;
      defaultMarkupPercent: number;
    }) => {
      const { data: items, error: fetchError } = await supabase
        .from("quote_items").select("*")
        .eq("quote_id", quoteId).eq("material_id", materialId);
      if (fetchError) throw fetchError;

      const updates = (items || []).map((it: any) => {
        const area = Number(it.area_m2 ?? it.min_qty_per_order ?? 1);
        const markup = it.markup_percent ?? defaultMarkupPercent;
        const finishing = Number(it.finishing_cost || 0);
        const unitCost = newCostPerM2 * area + finishing;
        const unitPrice = unitCost * (1 + markup / 100);
        const qty = Number(it.quantity || 0);
        const lineTotal = unitPrice * qty;
        return supabase.from("quote_items").update({
          cost_per_m2: newCostPerM2,
          unit_cost: unitCost,
          unit_price: unitPrice,
          line_total: lineTotal,
        }).eq("id", it.id);
      });

      await Promise.all(updates);
      return { quoteId, affected: items?.length || 0 };
    },
    onSuccess: ({ quoteId, affected }) => {
      queryClient.invalidateQueries({ queryKey: ["quote-pro", quoteId] });
      toast.success(`Osveženo ${affected} stavki`);
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

export function useUpdateQuoteItemPricingPro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      item, quoteDefaultMarkupPercent, tonerCostPerM2Eur, updates,
    }: {
      item: QuoteItem;
      quoteDefaultMarkupPercent: number;
      tonerCostPerM2Eur?: number;
      updates: Partial<QuoteItem> & { print_sides?: string };
    }) => {
      const next = {
        quantity: Number(updates.quantity ?? item.quantity ?? 0),
        area_m2: Number(updates.area_m2 ?? item.area_m2 ?? 0),
        cost_per_m2: Number(updates.cost_per_m2 ?? item.cost_per_m2 ?? 0),
        finishing_cost: Number(updates.finishing_cost ?? item.finishing_cost ?? 0),
        markup_percent:
          updates.markup_percent === undefined ? item.markup_percent : updates.markup_percent,
        custom_price:
          updates.custom_price === undefined ? item.custom_price : updates.custom_price,
        installation_standard_enabled:
          updates.installation_standard_enabled ?? item.installation_standard_enabled ?? false,
        installation_price_per_m2: Number(
          updates.installation_price_per_m2 ?? item.installation_price_per_m2 ?? 5
        ),
        installation_fixed_start: Number(
          updates.installation_fixed_start ?? item.installation_fixed_start ?? 20
        ),
        installation_high_enabled:
          updates.installation_high_enabled ?? item.installation_high_enabled ?? false,
        installation_high_price_per_m2: Number(
          updates.installation_high_price_per_m2 ?? item.installation_high_price_per_m2 ?? 10
        ),
        installation_high_fixed_start: Number(
          updates.installation_high_fixed_start ?? item.installation_high_fixed_start ?? 100
        ),
      };

      const effectiveMarkup = next.markup_percent ?? quoteDefaultMarkupPercent;
      const effectiveTonerCostPerM2Eur =
        tonerCostPerM2Eur ??
        (item as any).toner_cost_per_m2_eur ??
        deriveStoredTonerCostPerM2Eur({
          areaM2: item.area_m2,
          unitCost: item.unit_cost,
          costPerM2: item.cost_per_m2,
          finishingCost: item.finishing_cost,
        });
      const effectivePrintSides = (updates.print_sides ?? (item as any).print_sides ?? "4/0") as "4/0" | "4/4";

      const installEurPerUnit = computeInstallationCostEur(
        Number(next.area_m2 || 0) * Number(next.quantity || 0),
        {
          standardEnabled: next.installation_standard_enabled,
          standardPricePerM2Eur: next.installation_price_per_m2,
          standardFixedStartEur: next.installation_fixed_start,
          highEnabled: next.installation_high_enabled,
          highPricePerM2Eur: next.installation_high_price_per_m2,
          highFixedStartEur: next.installation_high_fixed_start,
        }
      );
      const installRsdTotal = installEurPerUnit * EUR_TO_RSD;

      const pricing = computeLargeFormatPricing({
        areaM2: next.area_m2,
        quantity: next.quantity,
        costPerM2: next.cost_per_m2,
        tonerCostPerM2Eur: effectiveTonerCostPerM2Eur,
        finishingCost: next.finishing_cost,
        markupPercent: effectiveMarkup ?? 0,
        customPrice: next.custom_price,
        printSides: effectivePrintSides,
        installationTotalRsd: installRsdTotal,
      });

      const payload = {
        ...updates,
        quantity: next.quantity,
        area_m2: next.area_m2,
        cost_per_m2: next.cost_per_m2,
        finishing_cost: next.finishing_cost,
        markup_percent: next.markup_percent,
        custom_price: next.custom_price,
        unit_cost: pricing.unitCost,
        unit_price: pricing.unitPrice,
        line_total: pricing.lineTotal,
        installation_standard_enabled: next.installation_standard_enabled,
        installation_price_per_m2: next.installation_price_per_m2,
        installation_fixed_start: next.installation_fixed_start,
        installation_high_enabled: next.installation_high_enabled,
        installation_high_price_per_m2: next.installation_high_price_per_m2,
        installation_high_fixed_start: next.installation_high_fixed_start,
        installation_cost: pricing.installationCostTotal,
        print_sides: effectivePrintSides,
        toner_cost_per_m2_eur: effectiveTonerCostPerM2Eur,
      };

      const { error } = await supabase.from("quote_items").update(payload as any).eq("id", item.id);
      if (error) throw error;
      return item.quote_id;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["quote-pro", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes-pro"] });
    },
    onError: (error: Error) => toast.error(`Greška: ${error.message}`),
  });
}

// -----------------------------------------------------------------------------
// GDC-compatible aliases (used by the new full-page /quotes, /quotes/new,
// /quotes/:id screens ported 1:1 from the GDC Order project).
// -----------------------------------------------------------------------------
export const useQuotes = useQuotesPro;
export const useQuote = useQuotePro;
export const useCreateQuote = useCreateQuotePro;
export const useUpdateQuote = useUpdateQuotePro;
export const useDeleteQuote = useDeleteQuotePro;
export const useDuplicateQuote = useDuplicateQuotePro;
export const useAddQuoteItem = useAddQuoteItemPro;
export const useUpdateQuoteItem = useUpdateQuoteItemPro;
export const useDeleteQuoteItem = useDeleteQuoteItemPro;
export const useRecalculateQuoteTotals = useRecalculateQuoteTotalsPro;
export const useBulkInsertQuoteItems = useBulkInsertQuoteItemsPro;
export const useUpdateMaterialCostInQuote = useUpdateMaterialCostInQuotePro;
export const useUpdateQuoteItemPricing = useUpdateQuoteItemPricingPro;


