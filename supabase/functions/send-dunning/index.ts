// Sends payment reminders (opomene) to customers with overdue invoices. Finance-access only.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendMail } from "../_shared/email-provider.ts";
import { parsePartnerIds, isValidEmail, isWinningClaim, dayStartIso, isUniqueViolation, LOG_PENDING } from "../_shared/dunningRules.ts";

const LOGO = "https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/newsletter-assets/gama-united-white.png";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const rsd = (v: number) => Number(v).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " RSD";
const d = (s: string) => s ? s.split("-").reverse().join(".") + "." : "—";
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const MON = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

function firstName(contact?: string | null) {
  const n = (contact ?? "").trim().split(/\s+/)[0];
  return n || null;
}

export function buildHtml(p: any, today: string) {
  const name = firstName(p.contact);
  const greet = name ? `Poštovani ${esc(name)},` : "Poštovani,";
  const overdue = (p.invoices as any[]).filter((i) => i.days > 0);
  const max = Math.max(1, ...p.months.map((m: any) => Math.max(m.invoiced, m.paid)));
  const bar = (v: number, color: string) => `<div style="height:8px;width:${Math.max(1, Math.round((v / max) * 100))}%;background:${color};border-radius:4px"></div>`;
  const rows = overdue.slice(0, 25).map((i) => `<tr>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(i.number)}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0">${d(i.date)}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0">${d(i.due)}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${rsd(i.open)}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#c53030">${i.days}</td></tr>`).join("");
  const chart = p.months.map((m: any) => {
    const [y, mo] = m.month.split("-");
    return `<tr><td style="padding:4px 8px;font-size:12px;color:#4a5568;white-space:nowrap">${MON[+mo - 1]} ${y.slice(2)}</td>
      <td style="padding:4px 8px;width:100%">${bar(m.invoiced, "#1a365d")}<div style="height:3px"></div>${bar(m.paid, "#38a169")}</td>
      <td style="padding:4px 8px;font-size:11px;color:#4a5568;white-space:nowrap;text-align:right">${rsd(m.invoiced)}<br><span style="color:#38a169">${rsd(m.paid)}</span></td></tr>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1a202c">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:24px 0"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#1a365d;padding:24px;text-align:center"><img src="${LOGO}" height="58" alt="Gama United"></td></tr>
<tr><td style="padding:28px">
<p style="font-size:16px">${greet}</p>
<p style="font-size:15px;line-height:1.6">Ovim putem vas ljubazno obaveštavamo da, prema našoj evidenciji na dan ${d(today)}, vaša dugovanja prema Gama United-u <b>van valute</b> iznose:</p>
<div style="background:#fff5f5;border:1px solid #feb2b2;border-radius:10px;padding:18px;text-align:center;margin:18px 0">
  <div style="font-size:13px;color:#742a2a">Dospelo, a neplaćeno</div>
  <div style="font-size:28px;font-weight:bold;color:#c53030">${rsd(p.overdue_rsd)}</div>
  <div style="font-size:12px;color:#742a2a">${p.overdue_docs} faktura · ukupno otvoreno ${rsd(p.open_rsd)}</div>
</div>
<p style="font-size:15px;line-height:1.6">Molimo vas da izmirite dospele obaveze u najkraćem mogućem roku. Redovne uplate nam omogućavaju da nabavljamo materijal na vreme i da nastavimo da radimo na visokom nivou kvaliteta i brzine na koji ste navikli.</p>
<p style="font-size:15px;line-height:1.6">Uplatu izvršite na tekući račun naveden na fakturi, sa brojem fakture kao pozivom na broj.</p>
<h3 style="font-size:15px;color:#1a365d;margin-top:24px">Dospele fakture</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse">
<tr style="background:#edf2f7;text-align:left"><th style="padding:8px">Broj</th><th style="padding:8px">Datum</th><th style="padding:8px">Rok</th><th style="padding:8px;text-align:right">Za uplatu</th><th style="padding:8px;text-align:right">Dana</th></tr>
${rows}</table>
${overdue.length > 25 ? `<p style="font-size:12px;color:#718096">… i još ${overdue.length - 25} faktura.</p>` : ""}
<h3 style="font-size:15px;color:#1a365d;margin-top:24px">Saradnja u poslednjih 12 meseci</h3>
<p style="font-size:12px;color:#4a5568"><span style="color:#1a365d">■</span> fakturisano &nbsp; <span style="color:#38a169">■</span> uplaćeno</p>
<table width="100%" cellpadding="0" cellspacing="0">${chart}</table>
<p style="font-size:14px;line-height:1.6;margin-top:24px">Ukoliko ste uplatu već izvršili, molimo vas da ovu poruku zanemarite. Za sva pitanja ili usaglašavanje stanja stojimo vam na raspolaganju.</p>
<p style="font-size:14px;line-height:1.6">Srdačan pozdrav,<br><b>Gama United d.o.o.</b></p>
</td></tr>
<tr><td style="background:#edf2f7;padding:16px;font-size:12px;color:#4a5568;text-align:center">GAMA UNITED d.o.o. · Veljka Milićevića 2/10, 11000 Beograd · PIB 114876455<br>Kontakt za finansije: <b>Natalija Kresović</b> · 063 689 993 · natalija.kresovic@gamaunited.rs</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await user.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Niste prijavljeni" }, 401);
    const { data: ok } = await user.rpc("has_finance_access");
    if (ok !== true) return json({ error: "Nemate pristup" }, 403);

    const body = await req.json().catch(() => ({}));
    const parsed = parsePartnerIds(body?.partner_ids);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const ids = parsed.ids;
    const test = body.test === true;
    const preview = body.preview === true;
    // Probe idu ISKLJUČIVO na adresu prijavljenog korisnika; proizvoljna adresa se ne prihvata.
    const testTo = u.user.email ?? null;
    if (test && !isValidEmail(testTo)) return json({ error: "Vaš nalog nema ispravnu email adresu za probu" }, 400);
    if (test && typeof body.test_email === "string" && body.test_email.trim().toLowerCase() !== testTo!.toLowerCase())
      return json({ error: "Proba se može poslati samo na vašu adresu" }, 400);

    const { data: aging, error } = await user.rpc("mm_receivables_aging");
    if (error) return json({ error: error.message }, 500);
    const today: string = (aging as any).today;
    const partners: any[] = (aging as any)?.partners ?? [];
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const results: any[] = [];
    for (const id of ids) {
      const p = partners.find((x: any) => Number(x.partner_minimax_id) === id);
      if (!p) { results.push({ id, error: "Nema otvorenih faktura" }); continue; }
      const html = buildHtml(p, today);
      if (preview) return json({ html });
      const overdue = Number(p.overdue_rsd);
      if (!(overdue > 0.5)) { results.push({ id, partner: p.partner, error: "Nema duga van valute" }); continue; }
      const to = test ? testTo! : (typeof p.email === "string" ? p.email.trim() : "");
      if (!to) { results.push({ id, partner: p.partner, error: "Nema email-a" }); continue; }
      if (!isValidEmail(to)) { results.push({ id, partner: p.partner, error: "Neispravan email kupca" }); continue; }

      let logId: string | null = null;
      if (!test) {
        // Zaštita od ponavljanja i paralelnih slanja: najpre upiši "pending" zahtev,
        // pa šalje samo najraniji zahtev za istog kupca u toku dana (uspešan ili u toku).
        const { data: claim, error: cErr } = await admin.from("mm_dunning_log").insert({
          partner_minimax_id: id, partner_name: p.partner, email: to, overdue_rsd: overdue,
          is_test: false, sent_by: u.user.id, error: LOG_PENDING,
        }).select("id, sent_at").single();
        if (isUniqueViolation(cErr)) { results.push({ id, partner: p.partner, error: "Opomena je danas već poslata ovom kupcu" }); continue; }
        if (cErr || !claim) { results.push({ id, partner: p.partner, error: "Nije poslato: evidencija nije upisana" }); continue; }
        logId = claim.id;
        const { data: claims, error: qErr } = await admin.from("mm_dunning_log")
          .select("id, sent_at").eq("partner_minimax_id", id).eq("is_test", false)
          .gte("sent_at", dayStartIso(today)).or(`error.is.null,error.eq.${LOG_PENDING}`);
        if (qErr || !isWinningClaim(logId!, claims ?? [])) {
          await admin.from("mm_dunning_log").update({ error: qErr ? "Nije poslato: provera duplikata nije uspela" : "Preskočeno: opomena je danas već poslata" }).eq("id", logId);
          results.push({ id, partner: p.partner, error: qErr ? "Provera duplikata nije uspela" : "Opomena je danas već poslata ovom kupcu" });
          continue;
        }
      }

      let err: string | null = null;
      try {
        await sendMail({ to, subject: `${test ? "[PROBA] " : ""}Podsetnik o dospelim dugovanjima – Gama United`, html, replyTo: "natalija.kresovic@gamaunited.rs" });
      } catch (e) { err = (e as Error).message || "Greška pri slanju"; }

      let warning: string | null = null;
      const logRes = logId
        ? await admin.from("mm_dunning_log").update({ error: err }).eq("id", logId)
        : await admin.from("mm_dunning_log").insert({ partner_minimax_id: id, partner_name: p.partner, email: to, overdue_rsd: overdue, is_test: true, sent_by: u.user.id, error: err });
      if (logRes.error) warning = "Evidencija slanja nije ažurirana";
      results.push({ id, partner: p.partner, to, error: err, warning });
    }
    return json({ results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
