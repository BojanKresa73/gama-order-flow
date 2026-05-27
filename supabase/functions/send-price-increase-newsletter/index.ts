// Generate and send a price-increase newsletter preview to a single recipient.
// Computes the per-client increase % using the same formula as CtpPriceIncreaseAnalysis,
// then renders an HTML email and sends it via the shared email provider.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OLD_COST = 2.4;
const NEW_COST = 2.8;
const SPREAD_FACTOR = 2.0;
const EFFECTIVE_DATE = "15.06.2026.";

function formatArea(formatName: string): number {
  const cleaned = formatName.replace("×", "x");
  const parts = cleaned.split("x");
  if (parts.length !== 2) return 0;
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  if (isNaN(w) || isNaN(h)) return 0;
  return (w / 1000) * (h / 1000);
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("sr-RS", { minimumFractionDigits: d, maximumFractionDigits: d });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clientName = "Birograf Comp", recipientEmail = "bojan.kresovic@gmail.com", overridePct } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Paginate file_entries (CTP)
    const PAGE = 1000;
    let from = 0;
    const all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("file_entries")
        .select(`quantity, plate_format_id, work_order:work_orders!inner (client_id, order_type, status, deleted_at, invalidated_at)`)
        .eq("file_type", "CTP")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = data ?? [];
      all.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;
    }

    const [{ data: clients }, { data: formats }, { data: prices }] = await Promise.all([
      supabase.from("clients").select("id, name"),
      supabase.from("plate_formats").select("id, format_name"),
      supabase.from("client_plate_prices").select("client_id, plate_format_id, price_eur, price_eur_mono"),
    ]);

    const formatMap = new Map((formats ?? []).map((f: any) => [f.id, f.format_name]));
    const clientMap = new Map((clients ?? []).map((c: any) => [c.id, c]));
    const priceMap = new Map((prices ?? []).map((p: any) => [`${p.client_id}-${p.plate_format_id}`, p]));

    const clientFormatPlates: Record<string, Record<string, number>> = {};
    for (const e of all) {
      const wo = e.work_order;
      if (!wo || wo.deleted_at || wo.invalidated_at) continue;
      if (wo.order_type !== "ctp") continue;
      if (!e.plate_format_id || !e.quantity) continue;
      if (!clientFormatPlates[wo.client_id]) clientFormatPlates[wo.client_id] = {};
      clientFormatPlates[wo.client_id][e.plate_format_id] =
        (clientFormatPlates[wo.client_id][e.plate_format_id] || 0) + e.quantity;
    }

    const clientTotalM2: Record<string, number> = {};
    for (const [cid, fp] of Object.entries(clientFormatPlates)) {
      let m2 = 0;
      for (const [fid, qty] of Object.entries(fp)) {
        const fname = formatMap.get(fid);
        if (fname) m2 += qty * formatArea(fname);
      }
      clientTotalM2[cid] = m2;
    }

    const sortedClients = Object.entries(clientTotalM2).filter(([, m2]) => m2 > 0).sort(([, a], [, b]) => b - a);
    if (sortedClients.length === 0) throw new Error("Nema podataka o potrošnji");
    const maxM2 = sortedClients[0][1];
    const baseCostDelta = NEW_COST - OLD_COST;

    // Find target client (case-insensitive match)
    const target = (clients ?? []).find((c: any) =>
      c.name.toLowerCase().includes(clientName.toLowerCase())
    );
    if (!target) throw new Error(`Klijent "${clientName}" nije pronađen`);

    const totalM2 = clientTotalM2[target.id] || 0;
    if (totalM2 === 0) throw new Error(`${target.name} nema CTP potrošnju`);

    const volumeRatio = totalM2 / maxM2;
    const rawFactor = 1 + SPREAD_FACTOR * (1 - volumeRatio);
    const normFactor = 1 + SPREAD_FACTOR * 0.5;
    const clientMultiplier = rawFactor / normFactor;

    // Compute current vs proposed revenue
    let currentRevenue = 0, proposedRevenue = 0, totalPlates = 0;
    const formatRows: Array<{ name: string; qty: number; oldPrice: number; newPrice: number; pct: number }> = [];
    for (const [fid, qty] of Object.entries(clientFormatPlates[target.id] || {})) {
      const fname = formatMap.get(fid) || "?";
      const area = formatArea(fname);
      const p = priceMap.get(`${target.id}-${fid}`);
      const oldPrice = p ? Number(p.price_eur) : 0;
      if (oldPrice <= 0) continue;
      const delta = area * baseCostDelta * clientMultiplier;
      const newPrice = Math.round((oldPrice + delta) * 100) / 100;
      const pct = (delta / oldPrice) * 100;
      currentRevenue += qty * oldPrice;
      proposedRevenue += qty * newPrice;
      totalPlates += qty;
      formatRows.push({ name: fname, qty, oldPrice, newPrice, pct });
    }
    formatRows.sort((a, b) => b.qty - a.qty);

    // If overridePct provided, scale every format's increase so the weighted average matches it.
    if (typeof overridePct === "number" && currentRevenue > 0) {
      let scaledProposed = 0;
      for (const r of formatRows) {
        const newPriceExact = r.oldPrice * (1 + overridePct / 100);
        r.newPrice = Math.round(newPriceExact * 100) / 100;
        r.pct = ((r.newPrice - r.oldPrice) / r.oldPrice) * 100;
        scaledProposed += r.qty * r.newPrice;
      }
      proposedRevenue = scaledProposed;
    }

    const avgIncreasePct = typeof overridePct === "number" ? overridePct : (currentRevenue > 0 ? ((proposedRevenue - currentRevenue) / currentRevenue) * 100 : 0);

    const formatRowsHtml = formatRows.map(r => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;font-weight:500;">${r.name} mm</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;">${fmt(r.oldPrice, 2)} €</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;color:#15803d;font-weight:600;">${fmt(r.newPrice, 2)} €</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;color:#b45309;font-weight:600;">+${fmt(r.pct, 2)}%</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="sr">
<head><meta charset="utf-8"><title>Najava korekcije cena CTP ploča</title></head>
<body style="margin:0;padding:0;background:#eef4fb;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(30,64,124,0.12);max-width:640px;">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 50%,#3b82f6 100%);padding:40px 32px 32px;">
            <img src="https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/newsletter-assets/gama-united-white.png" alt="Gama United" style="height:58px;display:inline-block;margin-bottom:18px;" />
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Najava korekcije cena CTP ploča</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:8px;letter-spacing:1px;text-transform:uppercase;">Primena od ${EFFECTIVE_DATE}</div>
          </td>
        </tr>
        <tr><td style="padding:36px 40px 32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">Poštovani partneri iz <strong>${target.name}</strong>,</p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
            Pre svega, želimo da Vam se iskreno zahvalimo na dugogodišnjoj saradnji i poverenju koje nam ukazujete.
            Vaša podrška je razlog zašto kontinuirano ulažemo u nove mašine, tehnologiju, edukaciju ljudi i digitalizaciju
            procesa — sve sa ciljem da Vam pružimo bržu, precizniju i pouzdaniju uslugu. Posebno cenimo što naše napore u
            unapređenju primećujete i podržavate.
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
            U periodu <strong>od februara do maja 2026. godine</strong> primili smo <strong>tri uzastopna povećanja
            nabavnih cena CTP ploča</strong> od strane naših dobavljača, usled geopolitičkih okolnosti, rasta cena
            sirovina i poremećaja u lancima snabdevanja.
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
            Do sada smo ove troškove u potpunosti preuzimali na sebe, ne želeći da dodatno opterećujemo naše klijente.
            Međutim, dalje održavanje postojećih cena više nije ekonomski održivo.
          </p>

          <p style="margin:0 0 20px;font-size:15px;line-height:1.65;">
            Iz tog razloga, obaveštavamo Vas da od <strong>${EFFECTIVE_DATE}</strong> godine
            <strong>korigujemo cene CTP ploča u proseku za ${fmt(avgIncreasePct, 2)}%</strong> za Vašu kompaniju.
            Procenat je izračunat na osnovu Vaše stvarne potrošnje i predstavlja minimum potreban da održimo kvalitet
            usluge i kontinuitet isporuke koji ste navikli.
          </p>

          <div style="background:linear-gradient(135deg,#dbeafe 0%,#eff6ff 100%);border-left:4px solid #2563eb;padding:18px 22px;border-radius:8px;margin:0 0 28px;">
            <div style="font-size:12px;color:#1e40af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;font-weight:600;">Prosečno povećanje za Vašu kompaniju</div>
            <div style="font-size:32px;font-weight:700;color:#1e3a8a;">+${fmt(avgIncreasePct, 2)}%</div>
            <div style="font-size:13px;color:#1e40af;margin-top:4px;">na osnovu ${fmt(totalPlates, 0)} ploča iz Vaše istorije porudžbina</div>
          </div>

          <h3 style="font-size:16px;margin:0 0 12px;color:#1e3a8a;">Pregled novih cena po formatima</h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
            <thead>
              <tr style="background:#eff6ff;">
                <th style="padding:11px 12px;text-align:left;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Format</th>
                <th style="padding:11px 12px;text-align:right;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Stara cena</th>
                <th style="padding:11px 12px;text-align:right;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Nova cena</th>
                <th style="padding:11px 12px;text-align:right;border-bottom:2px solid #bfdbfe;font-weight:600;color:#1e40af;">Rast</th>
              </tr>
            </thead>
            <tbody>${formatRowsHtml}</tbody>
          </table>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;">
            I dalje ostajemo posvećeni da Vam pružimo najbolji odnos kvaliteta, brzine i cene na tržištu.
            Verujemo da ćete imati razumevanja za ovu neophodnu korekciju i nadamo se nastavku uspešne saradnje.
          </p>

          <p style="margin:0 0 8px;font-size:15px;line-height:1.65;">
            Ukoliko imate bilo kakvih pitanja ili želite detaljniji pregled cena, stojimo Vam na raspolaganju.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #dbeafe;padding-top:20px;">
            <tr><td style="font-size:14px;line-height:1.6;color:#1f2937;">
              Srdačan pozdrav,<br>
              <strong style="color:#1e3a8a;font-size:15px;">Bojan Kresović</strong><br>
              <span style="color:#475569;">Direktor, Gama United d.o.o.</span><br>
              <span style="color:#475569;">📞 063 237 226</span><br>
              <span style="color:#475569;">✉ <a href="mailto:bojan.kresovic@gmail.com" style="color:#2563eb;text-decoration:none;">bojan.kresovic@gmail.com</a></span>
            </td></tr>
            <tr><td style="padding-top:14px;font-size:13px;color:#64748b;line-height:1.6;">
              <strong style="color:#1e40af;">Računovodstvo:</strong> <a href="mailto:natalija.kresovic@gamaunited.rs" style="color:#2563eb;text-decoration:none;">natalija.kresovic@gamaunited.rs</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f1f5f9;padding:20px 32px;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;">
          Gama United d.o.o. · Otona Župančiča · Beograd<br>
          Ova najava se odnosi isključivo na CTP ploče. Cene ostalih usluga ostaju nepromenjene.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    await sendMail({
      to: recipientEmail,
      subject: `[PREGLED v${Date.now().toString().slice(-6)}] Najava korekcije cena CTP ploča — ${target.name}`,
      html,
    });

    return new Response(JSON.stringify({
      ok: true,
      client: target.name,
      avgIncreasePct: Number(avgIncreasePct.toFixed(2)),
      totalPlates,
      formats: formatRows.length,
      sentTo: recipientEmail,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-price-increase-newsletter error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
