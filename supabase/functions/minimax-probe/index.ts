// READ-ONLY Minimax OAuth diagnostics + organisation list. Imports nothing, writes nothing.
// Never returns or logs secrets/tokens. No fallback values (Client Secret must be configured explicitly).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TOKEN_URL = "https://moj.minimax.rs/RS/AUT/OAuth20/Token";
const ORGS_URL = "https://moj.minimax.rs/RS/API/api/currentuser/orgs";
const GDC_ORG_ID = "52515";
const STUDIO_ORG_ID = "51495";
const UNITED_ORG_ID = "79412"; // confirmed by owner 12.10.2026; the only org allowed for business data
const UNITED_PIB = "114876455";
const NAMES = ["MINIMAX_CLIENT_ID", "MINIMAX_CLIENT_SECRET", "MINIMAX_USERNAME", "MINIMAX_PASSWORD"] as const;

function sanitize(text: string, secrets: string[]) {
  let t = text.slice(0, 400);
  for (const s of secrets) if (s && s.length >= 3) t = t.split(s).join("[skriveno]");
  return t.replace(/("?(access_token|refresh_token|password|client_secret)"?\s*[:=]\s*)"?[^",&\s}]+/gi, "$1[skriveno]");
}

function classify(status: number, code: string | null, desc: string) {
  const d = desc.toLowerCase();
  if (code === "invalid_client") {
    if (d.includes("secret")) return { cause: "client_secret", fix: "Minimax odbija Client Secret. Unesite tačan Client Secret registrovane API aplikacije (MINIMAX_CLIENT_SECRET)." };
    return { cause: "client_id", fix: "Minimax ne prepoznaje Client ID. Proverite MINIMAX_CLIENT_ID." };
  }
  if (code === "invalid_grant") return { cause: "user_credentials", fix: "Client ID/Secret su prihvaćeni, ali korisničko ime ili API lozinka nisu tačni (MINIMAX_USERNAME / MINIMAX_PASSWORD)." };
  if (code === "unauthorized_client" || code === "access_denied" || status === 403) return { cause: "authorization", fix: "Aplikacija ili korisnik nemaju ovlašćenje za API pristup. Proverite u Minimax-u dozvolu za API." };
  if (code === "invalid_scope") return { cause: "scope", fix: "Neispravan scope; očekuje se minimax.rs." };
  if (status >= 500) return { cause: "minimax_server", fix: "Greška na strani Minimax-a. Pokušajte kasnije." };
  return { cause: "unknown", fix: "Nepoznata greška pri prijavi; proverite sva četiri podatka." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Niste prijavljeni" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: allowed } = await db.rpc("has_finance_access" as any);
  if (!allowed) return json({ error: "Nemate pristup" }, 403);

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "login" || body?.mode === "sample" ? "login" : "check"; // default: no network call to Minimax

  const values = NAMES.map((n) => (Deno.env.get(n) ?? "").trim());
  const configured = Object.fromEntries(NAMES.map((n, i) => [n, values[i].trim().length > 0]));
  const missing = NAMES.filter((n) => !configured[n]);

  if (mode === "check" || missing.length) {
    return json({
      step: "configuration",
      configured,
      missing,
      login_attempted: false,
      fix: missing.length ? `Nedostaje: ${missing.join(", ")}` : "Sva četiri parametra su podešena. Prijava se pokreće samo na vaš zahtev.",
    }, missing.length && mode === "login" ? 400 : 200);
  }

  const [cid, csec, user, pass] = values;
  const tokRes = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: cid, client_secret: csec, username: user, password: pass, scope: "minimax.rs" }),
  });
  if (!tokRes.ok) {
    const raw = await tokRes.text();
    let code: string | null = null, desc = "";
    try { const j = JSON.parse(raw); code = j.error ?? null; desc = j.error_description ?? ""; } catch { desc = raw; }
    const c = classify(tokRes.status, code, desc);
    return json({
      step: "oauth_token", configured, login_attempted: true, success: false,
      http_status: tokRes.status, oauth_error: code, message: sanitize(desc, values),
      rejected: c.cause, fix: c.fix,
    });
  }
  const { access_token } = await tokRes.json();

  if (body?.mode === "sample") {
    // Organisation is fixed server-side. Never taken from request.
    const ORG = UNITED_ORG_ID;
    if (ORG === GDC_ORG_ID || ORG === STUDIO_ORG_ID) return json({ error: "Zabranjena organizacija" }, 403);
    const H = { Authorization: `Bearer ${access_token}` };
    const base = `https://moj.minimax.rs/RS/API/api/orgs/${ORG}`;
    const out: Record<string, unknown> = { organisation_id: ORG };
    for (const [kind, path] of [["izlazne", "issuedinvoices"], ["ulazne", "receivedinvoices"]] as const) {
      try {
        const r = await fetch(`${base}/${path}?PageSize=5&CurrentPage=1`, { signal: AbortSignal.timeout(20000), headers: H });
        if (!r.ok) { out[kind] = { error: r.status, message: sanitize(await r.text(), values) }; continue; }
        const j = await r.json();
        const rows = (j?.Rows ?? []).slice(0, 5);
        const idKey = kind === "izlazne" ? "IssuedInvoiceId" : "ReceivedInvoiceId";
        const details: any[] = [];
        for (const d of rows) {
          try {
            const dr = await fetch(`${base}/${path}/${d[idKey]}`, { signal: AbortSignal.timeout(20000), headers: H });
            details.push(dr.ok ? await dr.json() : null);
          } catch { details.push(null); }
        }
        const vatInfo = (x: any) => {
          if (!x) return { base: null, vat: null, keys: [] };
          const vr = x.IssuedInvoiceVatRows ?? x.ReceivedInvoiceVatRows ?? x.VatRows ?? x.ReceivedInvoiceRowsVAT ?? null;
          if (Array.isArray(vr) && vr.length) {
            const sum = (k: string[]) => vr.reduce((a: number, r: any) => a + Number(k.map((kk) => r[kk]).find((v) => v != null) ?? 0), 0);
            return { base: sum(["Base", "TaxBase", "Value", "BaseAmount"]), vat: sum(["VatAmount", "VAT", "Amount", "TaxAmount"]), keys: Object.keys(vr[0]) };
          }
          const ir = x.IssuedInvoiceRows ?? x.ReceivedInvoiceRows ?? [];
          return { base: null, vat: null, keys: Object.keys(x).filter((k) => /vat|tax|row|value|amount/i.test(k)), rowKeys: ir[0] ? Object.keys(ir[0]) : [] };
        };
        out[kind] = {
          total_in_minimax: j?.TotalRows ?? null,
          field_names: rows[0] ? Object.keys(rows[0]) : [],
          docs: rows.map((d: any, i: number) => { const v = vatInfo(details[i]); return {
            vat_keys: v.keys, row_keys: (v as any).rowKeys,
            number: d.InvoiceNumber ?? d.DocumentNumber ?? d.Number ?? null,
            type: d.InvoiceType ?? d.DocumentType ?? d.Type ?? null,
            status: d.Status ?? null,
            partner: d.Customer?.Name ?? d.Supplier?.Name ?? d.Customer?.Title ?? null,
            date: d.DateIssued ?? d.DateReceived ?? d.Date ?? null,
            currency: d.Currency?.Name ?? d.Currency?.Code ?? null,
            base: v.base, vat: v.vat,
            total: d.InvoiceValue ?? d.AmountWithVAT ?? d.TotalAmount ?? null,
            org_check: String(d.Organisation?.ID ?? ORG) === ORG,
          }; }),
        };
      } catch (e) { out[kind] = { error: String(e).slice(0, 200) }; }
    }
    return json({ step: "sample", success: true, ...out });
  }


  const orgRes = await fetch(ORGS_URL, { signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${access_token}` } });
  if (!orgRes.ok) {
    return json({ step: "organisations", configured, login_attempted: true, success: false, http_status: orgRes.status,
      rejected: "authorization", fix: "Prijava uspela, ali korisnik ne sme da čita spisak organizacija." });
  }
  const orgs = await orgRes.json();
  const rows = (orgs?.Rows ?? orgs ?? []).map((o: any) => ({
    organisation_id: String(o.Organisation?.ID ?? o.ID ?? ""),
    name: o.Organisation?.Name ?? o.Name ?? null,
    api_access: o.APIAccess ?? null,
    pib: null as string | null,
  }));
  // Read-only: organisation header only (name + PIB). No invoices, journals or other business data.
  for (const r of rows) {
    try {
      const d = await fetch(`https://moj.minimax.rs/RS/API/api/orgs/${r.organisation_id}`, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${access_token}` } });
      if (d.ok) { const o = await d.json(); r.pib = String(o.TaxNumber ?? o.VATIdentificationNumber ?? "").replace(/\D/g, "") || null; r.name = o.Title ?? o.Name ?? r.name; }
    } catch { /* ignore */ }
  }
  const united = rows.filter((r: any) => r.pib === UNITED_PIB && r.organisation_id !== GDC_ORG_ID);
  return json({
    step: "done", configured, login_attempted: true, success: true,
    organisations: rows.map((r: any) => ({ ...r, is_gdc: r.organisation_id === GDC_ORG_ID })),
    gama_united: united.length === 1 ? united[0] : null,
    note: united.length === 1 ? "Pronađena Gama United po PIB-u. Čeka se vaša potvrda pre bilo kakvog uvoza."
      : united.length > 1 ? "Više organizacija sa istim PIB-om — potrebna ručna potvrda."
      : `Organizacija sa PIB-om ${UNITED_PIB} nije dodeljena ovom API korisniku.`,
  });
});
