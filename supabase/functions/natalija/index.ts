// Natalija — Gama AI Brain. Read-only business assistant for Gama United.
// Access: only users listed in finance_access_grants (checked via has_finance_access()).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, tool, stepCountIs, type ModelMessage } from "npm:ai";
import { z } from "npm:zod@3";
import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BodySchema = z.object({
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4000),
});

const SYSTEM = `Ti si Natalija, AI poslovni analitičar firme Gama United d.o.o. (Beograd) — CTP osvetljavanje ofset ploča, filmovanje, digitalna tabak štampa, veliki formati i ostale usluge.
Odgovaraj ISKLJUČIVO na srpskom jeziku, latinicom, bez hrvatskih izraza (koristi: tabak, štampa, nedelja, januar...).
Pravila:
- Koristi alate da pronađeš PRAVE podatke. Nikad ne izmišljaj brojeve. Ako podatak ne postoji, reci to jasno.
- Za složena pitanja sam pozovi više alata zaredom, uporedi periode, proveri rezultat.
- Na kraju navedi izvor (period, filter, broj naloga) i kratku preporuku šta treba uraditi.
- Brojevi u srpskom formatu (1.234,5). Valuta EUR osim ako nije drugačije navedeno.
- Nalozi: CTP (ploče), film (metri filma), digital, large_format, other. Poništeni i obrisani nalozi se ne računaju.
- Potrošnja ploča računa se po datumu otvaranja naloga (created_at), otvoreni i zatvoreni nalozi.
- Nabavka ploča: rok od Kine ~3 meseca; cilj je da pri dolasku ostane bar dupla mesečna potrošnja.
- NIKAD ne mešaj ove veličine: broj ploča (kom), kvadratura (m²), prodajna vrednost po cenovniku (EUR, procena iz naloga) i stvarno fakturisano (iz Minimax-a). Uvek ih navedi odvojeno i imenuj tačno.
- Prodajna vrednost koristi cenu koja je važila na dan otvaranja naloga. Kad prikazuješ vrednost, pozovi ctp_unpriced_plates i jasno upozori ako postoje ploče bez poznate istorijske cene (one ulaze u vrednost kao 0).
- Lager i roba na putu (search_materials) su zalihe, NISU proizvodnja ni potrošnja — nikad ih ne sabiraj sa potrošnjom.
- Finansijski podaci iz Minimax-a (izlazne i ulazne fakture, predračuni, avansi, storna, knjižna odobrenja, plaćanja, potraživanja i obaveze, rezultat po mesecima) SU povezani i dostupni kroz alate finance_control, finance_profit i finance_documents — za takva pitanja uvek pozovi te alate i odgovaraj iz njihovih brojeva. Novčani iznosi su u RSD osim ako nije drugačije navedeno.
- Ti samo čitaš podatke. Nikad ne menjaš naloge ni bilo šta u bazi.
Današnji datum: ${new Date().toISOString().slice(0, 10)}.`;

async function fetchAll<T>(build: (from: number, to: number) => any, cap = 20000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function buildTools(db: SupabaseClient) {
  const d = (s: string | null, def: string) => s ?? def;
  const year = new Date().getFullYear();

  return {
    finance_control: tool({
      description: "Minimax Gama United (org 79412) – kontrola podataka: broj dokumenata baza vs Minimax, zbirovi po vrsti/godini, valute, status plaćanja, otvorena potraživanja/obaveze (iz dokumenata i iz glavne knjige), stanja po klasama konta i dokumenti 'Potrebna provera'. Neusaglašeno nikad ne predstavljati kao potvrđeno.",
      inputSchema: z.object({}),
      execute: async () => { const { data, error } = await db.rpc("mm_control_summary" as any); return error ? { error: error.message } : data; },
    }),
    finance_profit: tool({
      description: "Računovodstveni rezultat po mesecima za godinu iz glavne knjige (klase 5 i 6, bez zaključnih knjiženja): prihodi, rashodi, materijal (50/51), zarade (52), proizvodne usluge (53), amortizacija (54), ostalo, privremeni rezultat, oznake nedostajuće amortizacije i neproknjiženih dokumenata. Ovo je privremeni rezultat, ne zvanični bilans.",
      inputSchema: z.object({ year: z.number().int() }),
      execute: async (a) => { const { data, error } = await db.rpc("mm_profit_by_month" as any, { p_year: a.year }); return error ? { error: error.message } : data; },
    }),
    finance_documents: tool({
      description: "Pretraga Minimax dokumenata Gama United (izlazni 'issued' / ulazni 'received') po partneru, vrsti, periodu ili statusu provere.",
      inputSchema: z.object({
        direction: z.enum(["issued", "received"]).nullable(), partner: z.string().nullable(), kind: z.string().nullable(),
        date_from: z.string().nullable(), date_to: z.string().nullable(), only_review: z.boolean().nullable(), limit: z.number().int().nullable(),
      }),
      execute: async (a) => {
        let q = db.from("mm_documents" as any).select("direction,number,kind,doc_date,partner_name,currency,total_rsd,paid_rsd,open_rsd,base_rsd,vat_rsd,non_deductible_rsd,payment_status,review_status,review_reason")
          .order("doc_date", { ascending: false }).limit(Math.min(a.limit ?? 30, 100));
        if (a.direction) q = q.eq("direction", a.direction);
        if (a.partner) q = q.ilike("partner_name", `%${a.partner.replace(/[%,()]/g, " ")}%`);
        if (a.kind) q = q.eq("kind", a.kind);
        if (a.date_from) q = q.gte("doc_date", a.date_from);
        if (a.date_to) q = q.lte("doc_date", a.date_to);
        if (a.only_review) q = q.neq("review_status", "ok");
        const { data, error } = await q; return error ? { error: error.message } : data;
      },
    }),
    search_work_orders: tool({
      description: "Pretraga radnih naloga po tekstu (broj naloga, naziv posla, napomena), tipu, statusu, klijentu i periodu.",
      inputSchema: z.object({
        text: z.string().nullable(),
        order_type: z.enum(["ctp", "film", "digital", "large_format", "other"]).nullable(),
        status: z.enum(["open", "closed"]).nullable(),
        client_name: z.string().nullable(),
        date_from: z.string().nullable().describe("YYYY-MM-DD"),
        date_to: z.string().nullable().describe("YYYY-MM-DD"),
        limit: z.number().int().nullable(),
      }),
      execute: async (a) => {
        let q = db.from("work_orders")
          .select("id, display_order_number, order_type, status, job_name, notes, created_at, closed_at, invoiced_at, invoice_number, priority, clients(name)")
          .is("deleted_at", null).is("invalidated_at", null)
          .order("created_at", { ascending: false }).limit(Math.min(a.limit ?? 30, 100));
        if (a.order_type) q = q.eq("order_type", a.order_type);
        if (a.status) q = q.eq("status", a.status);
        if (a.date_from) q = q.gte("created_at", a.date_from);
        if (a.date_to) q = q.lte("created_at", a.date_to + "T23:59:59");
        if (a.text) {
          const t = a.text.replace(/[%,()]/g, " ");
          q = q.or(`display_order_number.ilike.%${t}%,job_name.ilike.%${t}%,notes.ilike.%${t}%`);
        }
        if (a.client_name) {
          const { data: cl } = await db.from("clients").select("id").ilike("name", `%${a.client_name}%`).limit(20);
          q = q.in("client_id", (cl ?? []).map((c: any) => c.id));
        }
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, orders: data };
      },
    }),

    get_work_order_details: tool({
      description: "Kompletni detalji jednog naloga (stavke, fajlovi, ploče, film, digital) po broju naloga npr. CTP-2026-000245 ili ID-ju.",
      inputSchema: z.object({ identifier: z.string() }),
      execute: async ({ identifier }) => {
        const { data, error } = await db.rpc("get_work_order_full", { p_identifier: identifier });
        return error ? { error: error.message } : data;
      },
    }),

    analyze_production: tool({
      description: "Analiza proizvodnje u periodu: broj naloga po tipu, ploče (CTP), metri filma, tabaci digitala, m² velikog formata, po mesecu i po tipu. Za poređenje perioda pozovi više puta.",
      inputSchema: z.object({
        date_from: z.string().describe("YYYY-MM-DD"),
        date_to: z.string().describe("YYYY-MM-DD"),
        client_name: z.string().nullable(),
      }),
      execute: async (a) => {
        let clientIds: string[] | null = null;
        if (a.client_name) {
          const { data: cl } = await db.from("clients").select("id").ilike("name", `%${a.client_name}%`).limit(20);
          clientIds = (cl ?? []).map((c: any) => c.id);
        }
        const rows = await fetchAll<any>((f, t) => {
          let q = db.from("work_orders")
            .select("id, order_type, status, created_at, file_entries(quantity, plate_format_id, file_type), film_jobs(computed_total_m), digital_jobs(computed_total_sheets, computed_line_total)")
            .is("deleted_at", null).is("invalidated_at", null)
            .gte("created_at", a.date_from).lte("created_at", a.date_to + "T23:59:59")
            .order("created_at").range(f, t);
          if (clientIds) q = q.in("client_id", clientIds);
          return q;
        });
        const byMonth: Record<string, any> = {};
        const byType: Record<string, number> = {};
        let plates = 0, filmM = 0, sheets = 0, open = 0;
        for (const r of rows) {
          const m = r.created_at.slice(0, 7);
          byMonth[m] ??= { orders: 0, ctp_plates: 0, film_m: 0, digital_sheets: 0 };
          byMonth[m].orders++;
          byType[r.order_type] = (byType[r.order_type] ?? 0) + 1;
          if (r.status === "open") open++;
          if (r.order_type === "ctp") {
            const p = (r.file_entries ?? []).filter((x: any) => x.plate_format_id && x.file_type === "CTP").reduce((s: number, x: any) => s + (x.quantity ?? 0), 0);
            plates += p; byMonth[m].ctp_plates += p;
          }
          const fm = (r.film_jobs ?? []).reduce((s: number, x: any) => s + Number(x.computed_total_m ?? 0), 0);
          filmM += fm; byMonth[m].film_m = Math.round((byMonth[m].film_m + fm) * 100) / 100;
          const sh = (r.digital_jobs ?? []).reduce((s: number, x: any) => s + (x.computed_total_sheets ?? 0), 0);
          sheets += sh; byMonth[m].digital_sheets += sh;
        }
        return { period: a, total_orders: rows.length, open_orders: open, by_type: byType, ctp_plates: plates, film_m: Math.round(filmM * 100) / 100, digital_sheets: sheets, by_month: byMonth };
      },
    }),

    ctp_consumption_by_format: tool({
      description: "Potrošnja CTP ploča po formatima u periodu (broj ploča, m², vrednost EUR).",
      inputSchema: z.object({ date_from: z.string(), date_to: z.string() }),
      execute: async (a) => {
        const { data, error } = await db.rpc("get_ctp_consumption_by_format", {
          p_from: a.date_from, p_to: a.date_to, p_client_ids: null, p_plate_format_ids: null,
        } as any);
        return error ? { error: error.message } : data;
      },
    }),

    ctp_top_clients: tool({
      description: "Najveći CTP klijenti u periodu (ploče, vrednost).",
      inputSchema: z.object({ date_from: z.string(), date_to: z.string() }),
      execute: async (a) => {
        const { data, error } = await db.rpc("get_ctp_top_clients", {
          p_from: a.date_from, p_to: a.date_to, p_client_ids: null, p_plate_format_ids: null,
        } as any);
        return error ? { error: error.message } : data;
      },
    }),

    ctp_unpriced_plates: tool({
      description: "CTP ploče u periodu za koje klijent NEMA cenu važeću na dan naloga (upozorenje za prodajnu vrednost).",
      inputSchema: z.object({ date_from: z.string(), date_to: z.string() }),
      execute: async (a) => {
        const { data, error } = await db.rpc("get_ctp_unpriced_plates" as any, { p_from: a.date_from, p_to: a.date_to });
        return error ? { error: error.message } : { rows: data, total_unpriced_plates: (data ?? []).reduce((s: number, r: any) => s + Number(r.plates), 0) };
      },
    }),

    search_customers: tool({
      description: "Pretraga klijenata po nazivu, PIB-u ili gradu. Vraća osnovne podatke, rabat, rok plaćanja.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const t = query.replace(/[%,()]/g, " ");
        const { data, error } = await db.from("clients")
          .select("id, name, pib, grad, email, telefon, kontakt_osoba, rabat_procenat, rok_placanja_dana, is_vip, is_blocked, is_prospect, segment, has_mono_pricing, last_activity_at")
          .or(`name.ilike.%${t}%,pib.ilike.%${t}%,grad.ilike.%${t}%`).limit(25);
        return error ? { error: error.message } : data;
      },
    }),

    analyze_customer: tool({
      description: "Detaljna analiza jednog klijenta: statistika naloga po tipu, mesečna CTP potrošnja za godinu, cenovnik ploča.",
      inputSchema: z.object({ client_id: z.string().uuid(), year: z.number().int().nullable() }),
      execute: async ({ client_id, year: y }) => {
        const [stats, monthly, prices] = await Promise.all([
          db.rpc("get_client_stats", { p_client_id: client_id }),
          db.rpc("get_client_ctp_monthly", { p_client_id: client_id, p_year: y ?? year }),
          db.from("client_plate_prices").select("price_eur, price_eur_mono, valid_from, plate_formats(format_name)").eq("client_id", client_id),
        ]);
        return { stats: stats.data ?? stats.error?.message, ctp_monthly: monthly.data ?? monthly.error?.message, plate_prices: prices.data };
      },
    }),

    search_materials: tool({
      description: "Lager ploča po formatima i porudžbine u nabavci (na putu / stigle), sa količinama i cenama po m².",
      inputSchema: z.object({ format: z.string().nullable() }),
      execute: async ({ format }) => {
        let pf = db.from("plate_formats").select("id, format_name, format_group, current_stock, low_stock_threshold, low_stock").order("format_name");
        if (format) pf = pf.ilike("format_name", `%${format}%`);
        const [stock, proc] = await Promise.all([
          pf,
          db.from("procurement_orders")
            .select("supplier_name, order_date, expected_arrival_date, actual_arrival_date, status, transport_cost, other_costs, procurement_order_items(quantity, price_per_m2, width_mm, height_mm, plate_formats(format_name))")
            .order("order_date", { ascending: false }).limit(15),
        ]);
        return { stock: stock.data, procurement: proc.data };
      },
    }),

    plate_consumption_history: tool({
      description: "Mesečna potrošnja ploča po formatu za poslednjih 12 meseci (za prognozu nabavke).",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await db.rpc("get_format_monthly_consumption");
        return error ? { error: error.message } : data;
      },
    }),

    invoicing_status: tool({
      description: "Zatvoreni nalozi koji NISU fakturisani u periodu (kontrola fakturisanja iz naloga), grupisano po klijentu.",
      inputSchema: z.object({ date_from: z.string(), date_to: z.string() }),
      execute: async (a) => {
        const rows = await fetchAll<any>((f, t) => db.from("work_orders")
          .select("display_order_number, order_type, closed_at, clients(name)")
          .eq("status", "closed").is("invoiced_at", null).is("deleted_at", null).is("invalidated_at", null)
          .gte("closed_at", a.date_from).lte("closed_at", a.date_to + "T23:59:59").range(f, t));
        const byClient: Record<string, number> = {};
        for (const r of rows) { const n = r.clients?.name ?? "?"; byClient[n] = (byClient[n] ?? 0) + 1; }
        return { not_invoiced: rows.length, by_client: byClient, sample: rows.slice(0, 30) };
      },
    }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Niste prijavljeni" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: ue } = await db.auth.getUser(auth.slice(7));
    if (ue || !u.user) return json({ error: "Niste prijavljeni" }, 401);
    const { data: allowed } = await db.rpc("has_finance_access" as any);
    if (!allowed) return json({ error: "Nemate pristup Nataliji" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Neispravan zahtev" }, 400);
    const { message } = parsed.data;
    let conversationId = parsed.data.conversation_id ?? null;

    if (!conversationId) {
      const { data: c, error } = await db.from("ai_conversations")
        .insert({ user_id: u.user.id, title: message.slice(0, 80) }).select("id").single();
      if (error) return json({ error: error.message }, 500);
      conversationId = c.id;
    }
    const { data: hist } = await db.from("ai_messages").select("role, content")
      .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(20);
    const messages: ModelMessage[] = [
      ...((hist ?? []).reverse().map((m: any) => ({ role: m.role, content: m.content })) as ModelMessage[]),
      { role: "user", content: message },
    ];
    await db.from("ai_messages").insert({ conversation_id: conversationId, user_id: u.user.id, role: "user", content: message });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI nije podešen" }, 500);
    const runIdFetch = createLovableAiGatewayRunIdFetch(undefined);
    const provider = createOpenAI({
      baseURL: GATEWAY, apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    let streamError: unknown = null;
    const result = streamText({
      model: provider.responses(MODEL),
      system: SYSTEM,
      messages,
      tools: buildTools(db),
      stopWhen: stepCountIs(10),
      abortSignal: req.signal,
      onError: ({ error }) => { streamError = error; },
      providerOptions: {
        openai: {
          forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto",
          store: false, include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = await result.text;
    if (streamError || !text) {
      const e: any = streamError;
      const status = e?.statusCode ?? 500;
      const msg = status === 402 ? "Nema dovoljno AI kredita. Dopunite kredite u podešavanjima." :
        status === 429 ? "Previše zahteva, pokušajte za minut." : (e?.message ?? "Natalija nije uspela da odgovori.");
      return json({ error: msg, conversation_id: conversationId }, status === 402 || status === 429 || status === 403 ? status : 500);
    }
    const steps = await result.steps;
    const toolsUsed = steps.flatMap((s: any) => (s.toolCalls ?? []).map((t: any) => ({ name: t.toolName, input: t.input })));
    await db.from("ai_messages").insert({ conversation_id: conversationId, user_id: u.user.id, role: "assistant", content: text, tools_used: toolsUsed });
    await db.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    return json({ conversation_id: conversationId, answer: text, tools_used: toolsUsed });
  } catch (e) {
    console.error("natalija error", e);
    return json({ error: e instanceof Error ? e.message : "Greška" }, 500);
  }
});
