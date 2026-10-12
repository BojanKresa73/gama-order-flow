// READ-ONLY Minimax -> local mirror for Gama United (org 79412 only). Only GET requests to Minimax.
// Resumable per entity (page cursor), idempotent upserts by (org, Minimax ID). Never touches work orders/prices.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  UNITED_ORG_ID, BLOCKED_ORG_IDS, assertUnitedOrg, classifyIssued, openReceivable, classifyReceived, openAmount,
  accountCodeFromName, summarizeVat, receivedJournalKey, journalDescriptionKey,
} from "../_shared/minimaxFinance.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const ORG = UNITED_ORG_ID; // fixed; never read from request
const BASE = `https://moj.minimax.rs/RS/API/api/orgs/${ORG}`;
const LIST = ["customers", "accounts", "issuedinvoices", "receivedinvoices", "journals"] as const;
const BUDGET_MS = 110_000;
const d = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));

async function token() {
  const v = ["MINIMAX_CLIENT_ID", "MINIMAX_CLIENT_SECRET", "MINIMAX_USERNAME", "MINIMAX_PASSWORD"].map((k) => (Deno.env.get(k) ?? "").trim());
  const r = await fetch("https://moj.minimax.rs/RS/AUT/OAuth20/Token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: v[0], client_secret: v[1], username: v[2], password: v[3], scope: "minimax.rs" }),
  });
  if (!r.ok) throw new Error(`Prijava na Minimax odbijena (${r.status})`);
  return (await r.json()).access_token as string;
}

async function get(tok: string, path: string) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${BASE}/${path}`, { method: "GET", headers: { Authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 1500 * (i + 1))); continue; }
    if (!r.ok) throw new Error(`GET ${path.split("?")[0]} -> ${r.status}`);
    return await r.json();
  }
  throw new Error(`GET ${path.split("?")[0]} -> ponovljene greške`);
}

function mapRow(entity: string, x: any) {
  switch (entity) {
    case "customers": return { minimax_id: x.CustomerId, code: x.Code, name: (x.Name ?? "").trim(), tax_number: x.TaxNumber, usage: x.Usage, raw: x };
    case "accounts": return { minimax_id: x.AccountId, code: x.Code, name: x.Name, allowed_posting: x.AllowedPosting };
    case "issuedinvoices": {
      const kind = classifyIssued(x);
      const total = n(x.InvoiceValue), paid = n(x.PaidValue);
      const review = total == null ? "Nepoznat ukupan iznos" : null;
      return { direction: "issued", minimax_id: x.IssuedInvoiceId, year: x.Year, number: `${x.DocumentNumbering?.Name ?? x.Numbering ?? ""}${x.InvoiceNumber}`,
        kind, status: x.Status, payment_status: x.PaymentStatus, partner_minimax_id: x.Customer?.ID, partner_name: x.Customer?.Name,
        doc_date: d(x.DateIssued), due_date: d(x.DateDue), currency: x.Currency?.Name, total_rsd: total, paid_rsd: paid,
        open_rsd: openReceivable(x), review_status: review ? "potrebna_provera" : "ok", review_reason: review, raw: x };
    }
    case "receivedinvoices": {
      const kind = classifyReceived(x);
      const total = n(x.InvoiceValue);
      return { direction: "received", minimax_id: x.ReceivedInvoiceId, year: x.Year, number: x.DocumentReference ?? `${x.Year}-${x.InvoiceNumber}`,
        kind, status: x.Status, payment_status: x.PaymentStatus, partner_minimax_id: x.Customer?.ID, partner_name: x.Customer?.Name,
        doc_date: d(x.DateIssued), due_date: d(x.DateDue), currency: x.Currency?.Name, total_rsd: total, paid_rsd: n(x.PaidValue),
        open_rsd: kind === "nacrt" ? null : openAmount(total, n(x.PaidValue)),
        journal_key: receivedJournalKey(x.Year, x.InvoiceNumber, x.DocumentReference), raw: x };
    }
    case "journals": return { minimax_id: x.JournalId, journal_type: x.JournalType?.Name, journal_date: d(x.JournalDate),
      year: x.JournalDate ? Number(x.JournalDate.slice(0, 4)) : null, description: x.Description };
  }
}
const TABLE: Record<string, [string, string]> = {
  customers: ["mm_partners", "org_id,minimax_id"], accounts: ["mm_accounts", "org_id,minimax_id"],
  issuedinvoices: ["mm_documents", "org_id,direction,minimax_id"], receivedinvoices: ["mm_documents", "org_id,direction,minimax_id"],
  journals: ["mm_journals", "org_id,minimax_id"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Niste prijavljeni" }, 401);
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: allowed } = await user.rpc("has_finance_access" as any);
  if (!allowed) return json({ error: "Nemate pristup" }, 403);
  assertUnitedOrg(ORG);
  if ((BLOCKED_ORG_IDS as readonly string[]).includes(ORG)) return json({ error: "Zabranjena organizacija" }, 403);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const step = String(body?.step ?? "");
  const t0 = Date.now();
  const setState = (entity: string, patch: Record<string, unknown>) =>
    db.from("mm_sync_state").upsert({ org_id: ORG, entity, ...patch, updated_at: new Date().toISOString() }, { onConflict: "org_id,entity" });

  try {
    const tok = await token();

    if ((LIST as readonly string[]).includes(step)) {
      const year = step === "journals" ? Number(body?.year) : null;
      if (step === "journals" && !(Number.isInteger(year) && year! >= 2020 && year! <= 2035)) return json({ error: "Za knjiženja je obavezna godina" }, 400);
      const sk = year ? `journals_${year}` : step;
      const filter = year ? `&DateFrom=${year}-01-01&DateTo=${year}-12-31` : "";
      const { data: st } = await db.from("mm_sync_state").select("*").eq("entity", sk).maybeSingle();
      let page = body?.restart ? 1 : (st?.next_page ?? 1);
      let fetched = page === 1 ? 0 : (st?.fetched ?? 0);
      let total: number | null = st?.total_remote ?? null;
      await setState(sk, { status: "running", last_error: null });
      while (Date.now() - t0 < BUDGET_MS) {
        const j = await get(tok, `${step}?PageSize=100&CurrentPage=${page}${filter}`);
        total = j.TotalRows || total;
        const rows = (j.Rows ?? []).map((x: any) => ({ org_id: ORG, ...mapRow(step, x), synced_at: new Date().toISOString() }));
        if (rows.length) {
          const [tbl, conflict] = TABLE[step];
          const { error } = await db.from(tbl).upsert(rows, { onConflict: conflict });
          if (error) throw new Error(`Upis ${tbl}: ${error.message}`);
        }
        fetched += rows.length; page++;
        if (rows.length < 100 || (total != null && fetched >= total)) {
          if (total != null && fetched !== total) {
            await setState(sk, { status: "error", total_remote: total, fetched, next_page: 1,
              last_error: `Odstupanje broja: Minimax ${total}, preuzeto ${fetched}. Faza zaustavljena.` });
            return json({ step: sk, done: false, integrity_error: true, total, fetched });
          }
          await setState(sk, { status: "done", total_remote: total, fetched, next_page: 1 });
          return json({ step: sk, done: true, total, fetched });
        }
        await setState(sk, { status: "running", total_remote: total, fetched, next_page: page });
      }
      return json({ step: sk, done: false, total, fetched, next_page: page });
    }

    if (step === "journal_details") {
      const { data: acc } = await db.from("mm_accounts").select("minimax_id,code").limit(5000);
      const accMap = new Map((acc ?? []).map((a: any) => [Number(a.minimax_id), a.code]));
      let processed = 0;
      await setState("journal_details", { status: "running" });
      while (Date.now() - t0 < BUDGET_MS) {
        const { data: todo } = await db.from("mm_journals").select("minimax_id,journal_type").eq("detail_loaded", false).limit(8);
        if (!todo?.length) break;
        await Promise.all(todo.map(async (jr: any) => {
          const x = await get(tok, `journals/${jr.minimax_id}`);
          const entries = (x.JournalEntries ?? []).map((e: any) => ({
            org_id: ORG, minimax_id: e.JournalEntryId, journal_minimax_id: jr.minimax_id, journal_type: jr.journal_type,
            entry_date: d(e.JournalEntryDate ?? x.JournalDate), year: Number((e.JournalEntryDate ?? x.JournalDate).slice(0, 4)),
            account_minimax_id: e.Account?.ID, account_code: accMap.get(Number(e.Account?.ID)) ?? accountCodeFromName(e.Account?.Name),
            account_name: e.Account?.Name, partner_minimax_id: e.Customer?.ID ?? null, currency: e.Currency?.Name,
            debit_rsd: Number(e.DebitInDomesticCurrency ?? 0), credit_rsd: Number(e.CreditInDomesticCurrency ?? 0),
            description: (e.Description ?? "").slice(0, 300),
          }));
          const vats = (x.VatEntries ?? []).map((v: any, i: number) => ({
            org_id: ORG, journal_minimax_id: jr.minimax_id, row_index: i,
            base: (v.VatEntryRows ?? []).reduce((a: number, r: any) => a + Number(r.VatBase ?? 0) + Number(r.ServicesVatBase ?? 0), 0),
            vat: (v.VatEntryRows ?? []).reduce((a: number, r: any) => a + Number(r.Vat ?? 0) + Number(r.ServicesVat ?? 0), 0),
            non_deductible: (v.VatEntryRows ?? []).reduce((a: number, r: any) => a + Number(r.NonDeductibleVatBase ?? 0) + Number(r.NonDeductibleVat ?? 0) + Number(r.ServicesNonDeductibleVatBase ?? 0) + Number(r.ServicesNonDeductibleVat ?? 0), 0),
            raw: v,
          }));
          if (entries.length) { const { error } = await db.from("mm_ledger_rows").upsert(entries, { onConflict: "org_id,minimax_id" }); if (error) throw new Error(error.message); }
          if (vats.length) { const { error } = await db.from("mm_vat_rows").upsert(vats, { onConflict: "org_id,journal_minimax_id,row_index" }); if (error) throw new Error(error.message); }
          await db.from("mm_journals").update({ detail_loaded: true, status: x.Status, entries_count: entries.length, vat_count: vats.length, row_version: x.RowVersion })
            .eq("org_id", ORG).eq("minimax_id", jr.minimax_id);
        }));
        processed += todo.length;
      }
      const { count } = await db.from("mm_journals").select("minimax_id", { count: "exact", head: true }).eq("detail_loaded", false);
      await setState("journal_details", { status: count ? "running" : "done" });
      return json({ step, processed, remaining: count });
    }

    if (step === "link_vat") {
      // Received invoice base/VAT only from PR journal VAT records. No 1.2 division. Unmatched -> Potrebna provera.
      let from = 0, linked = 0, review = 0;
      // All PR journals once, keyed by normalized description (handles "PR:", "PR;", "AR" prefix).
      const prByKey = new Map<string, number[]>();
      for (let f = 0; ; f += 1000) {
        const { data } = await db.from("mm_journals").select("minimax_id,description").eq("journal_type", "PR").range(f, f + 999);
        if (!data?.length) break;
        for (const j of data as any[]) { const k = journalDescriptionKey(j.description ?? ""); prByKey.set(k, [...(prByKey.get(k) ?? []), j.minimax_id]); }
        if (data.length < 1000) break;
      }
      for (;;) {
        const { data: docs } = await db.from("mm_documents").select("minimax_id,kind,total_rsd,currency,journal_key").eq("direction", "received").range(from, from + 499);
        if (!docs?.length) break;
        for (const doc of docs as any[]) {
          const ids = prByKey.get(doc.journal_key ?? "") ?? [];
          let rows: any[] = [];
          if (ids.length) { const { data } = await db.from("mm_vat_rows").select("raw").in("journal_minimax_id", ids); rows = (data ?? []).flatMap((r: any) => r.raw?.VatEntryRows ?? []); }
          const s = summarizeVat(rows, doc.total_rsd);
          let reason: string | null = null;
          if (doc.kind === "nacrt") reason = "Nacrt – nije proknjižen";
          else if (!ids.length) reason = "Nema povezanog PR knjiženja";
          else if (ids.length > 1) reason = "Više PR knjiženja za isti dokument";
          else if (s.status !== "ok") reason = doc.total_rsd === 0 ? "Ukupno 0, a PDV evidencija ima osnovicu – ne pretpostavlja se zatvaranje avansom" : "Zbir PDV evidencije ≠ ukupan iznos";
          if (!reason && doc.currency && doc.currency !== "RSD" && s.status !== "ok") reason = "Strana valuta – proveriti kurs";
          await db.from("mm_documents").update({
            base_rsd: s.base, vat_rsd: s.vat, non_deductible_rsd: s.non_deductible, vat_status: s.status,
            review_status: reason ? "potrebna_provera" : "ok", review_reason: reason,
          }).eq("org_id", ORG).eq("direction", "received").eq("minimax_id", doc.minimax_id);
          reason ? review++ : linked++;
        }
        from += 500;
      }
      await setState("link_vat", { status: "done", fetched: linked + review });
      return json({ step, linked, review });
    }

    return json({ error: "Nepoznat korak" }, 400);
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 300);
    if (step) await setState(step, { status: "error", last_error: msg });
    return json({ step, error: msg }, 500);
  }
});
