// Newsletter o povećanju cena FILMOVANJA (od 01.07.2026)
// Mode "preview": šalje samo jednom recipient-u (default bojan.kresovic@gmail.com)
// Mode "send-all": šalje svim klijentima koji imaju bar jedan film nalog i imaju email

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OLD_COST = 15.0;
const NEW_COST = 19.2;
const OLD_PRICE = 22.0;
const NEW_PRICE = 26.0;
const EFFECTIVE_DATE = "01.07.2026.";

function fmt(n: number, d = 2) {
  return n.toLocaleString("sr-RS", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function buildHtml(clientName: string, previewTag?: string) {
  const pct = ((NEW_PRICE - OLD_PRICE) / OLD_PRICE) * 100;
  return `<!DOCTYPE html>
<html lang="sr"><head><meta charset="utf-8"><title>Najava korekcije cene filmovanja</title></head>
<body style="margin:0;padding:0;background:#eef4fb;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(30,64,124,0.12);max-width:640px;">
  <tr><td align="center" style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 50%,#3b82f6 100%);padding:40px 32px 32px;">
    <img src="https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/newsletter-assets/gama-united-white.png" alt="Gama United" style="height:58px;display:inline-block;margin-bottom:18px;" />
    <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">Najava korekcije cene filmovanja</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:8px;letter-spacing:1px;text-transform:uppercase;">Primena od ${EFFECTIVE_DATE}</div>
  </td></tr>
  <tr><td style="padding:36px 40px 32px;">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">Poštovani partneri iz <strong>${clientName}</strong>,</p>

    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
      Pre svega, hvala Vam na dugogodišnjem poverenju i saradnji na uslugama <strong>filmovanja</strong>.
      Kontinuirano ulažemo u opremu, materijale i ljude kako bismo održali kvalitet i pouzdanost isporuke
      na koju ste navikli.
    </p>

    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
      Nažalost, primorani smo da Vas obavestimo da su naši dobavljači <strong>filmskog materijala</strong>
      povećali nabavne cene, usled rasta cena sirovina i troškova uvoza. Do sada smo ovo povećanje u
      potpunosti pokrivali iz sopstvene marže, ali dalje zadržavanje postojeće cene više nije održivo.
    </p>

    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;">
      Iz tog razloga, od <strong>${EFFECTIVE_DATE}</strong> godine, cena usluge filmovanja se sa
      <strong>${fmt(OLD_PRICE)} €/m</strong> koriguje na <strong>${fmt(NEW_PRICE)} €/m</strong>.
    </p>

    <div style="background:linear-gradient(135deg,#dbeafe 0%,#eff6ff 100%);border-left:4px solid #2563eb;padding:18px 22px;border-radius:8px;margin:0 0 28px;">
      <div style="font-size:12px;color:#1e40af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;font-weight:600;">Nova cena usluge</div>
      <div style="font-size:32px;font-weight:700;color:#1e3a8a;">${fmt(NEW_PRICE)} €/m</div>
      <div style="font-size:13px;color:#1e40af;margin-top:4px;">stara cena ${fmt(OLD_PRICE)} €/m &middot; povećanje +${fmt(pct)}%</div>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <thead>
        <tr style="background:#eff6ff;">
          <th style="padding:11px 12px;text-align:left;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Usluga</th>
          <th style="padding:11px 12px;text-align:right;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Stara cena</th>
          <th style="padding:11px 12px;text-align:right;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Nova cena</th>
          <th style="padding:11px 12px;text-align:right;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Rast</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;font-weight:500;">Filmovanje (rolna 500&nbsp;mm)</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;">${fmt(OLD_PRICE)} €/m</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;color:#15803d;font-weight:600;">${fmt(NEW_PRICE)} €/m</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;color:#b45309;font-weight:600;">+${fmt(pct)}%</td>
        </tr>
      </tbody>
    </table>

    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
      Nova cena važi za sve naloge otvorene <strong>od ${EFFECTIVE_DATE}</strong>. Nalozi koji su
      otvoreni pre tog datuma biće fakturisani po dosadašnjoj ceni.
    </p>

    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
      Zahvaljujemo se na razumevanju i nastavljamo da Vam pružamo najbolji odnos kvaliteta, brzine i cene.
      Za bilo kakva pitanja stojimo Vam na raspolaganju.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #dbeafe;padding-top:20px;">
      <tr><td style="font-size:14px;line-height:1.6;color:#1f2937;">
        Srdačan pozdrav,<br>
        <strong style="color:#1e3a8a;font-size:15px;">Bojan Kresović</strong><br>
        <span style="color:#475569;">Direktor, Gama United d.o.o.</span><br>
        <span style="color:#475569;">063 237 226</span><br>
        <span style="color:#475569;"><a href="mailto:bojan.kresovic@gmail.com" style="color:#2563eb;text-decoration:none;">bojan.kresovic@gmail.com</a></span>
      </td></tr>
      <tr><td style="padding-top:14px;font-size:13px;color:#64748b;line-height:1.6;">
        <strong style="color:#1e40af;">Računovodstvo:</strong> <a href="mailto:natalija.kresovic@gamaunited.rs" style="color:#2563eb;text-decoration:none;">natalija.kresovic@gamaunited.rs</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#f1f5f9;padding:20px 32px;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;">
    Gama United d.o.o. &middot; Otona Župančiča &middot; Beograd<br>
    Ova najava se odnosi isključivo na uslugu filmovanja. Cene ostalih usluga ostaju nepromenjene.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode: "preview" | "send-all" = body.mode || "preview";
    const previewEmail: string = body.previewEmail || "bojan.kresovic@gmail.com";
    const cleanSubject: boolean = body.cleanSubject === true;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (mode === "preview") {
      const html = buildHtml("Vaša Kompanija (PREGLED)");
      const subject = cleanSubject
        ? "Najava korekcije cene filmovanja od 01.07.2026"
        : `[PREGLED v${Date.now().toString().slice(-6)}] Najava korekcije cene filmovanja`;
      await sendMail({ to: previewEmail, subject, html });
      return new Response(JSON.stringify({ ok: true, mode, sentTo: previewEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // send-all: pronađi sve klijente koji imaju bar jedan film nalog i imaju email
    const { data: rows, error } = await supabase
      .from("work_orders")
      .select("client_id, clients!inner(id, name, email)")
      .eq("order_type", "film")
      .is("deleted_at", null);
    if (error) throw error;

    const seen = new Set<string>();
    const targets: Array<{ id: string; name: string; email: string }> = [];
    for (const r of rows || []) {
      const c: any = (r as any).clients;
      if (!c?.email) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      targets.push({ id: c.id, name: c.name, email: c.email });
    }

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const t of targets) {
      try {
        const html = buildHtml(t.name);
        await sendMail({
          to: t.email,
          subject: "Najava korekcije cene filmovanja od 01.07.2026",
          html,
        });
        results.push({ email: t.email, ok: true });
        await new Promise((r) => setTimeout(r, 1100)); // ~1.1s throttle
      } catch (e) {
        results.push({ email: t.email, ok: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({
      ok: true, mode, totalClients: targets.length,
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-film-price-increase-newsletter error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
