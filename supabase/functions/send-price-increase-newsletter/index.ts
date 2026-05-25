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
    const { clientName = "Birograf Comp", recipientEmail = "bojan.kresovic@gmail.com" } = await req.json().catch(() => ({}));

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
    const avgIncreasePct = currentRevenue > 0 ? ((proposedRevenue - currentRevenue) / currentRevenue) * 100 : 0;

    const formatRowsHtml = formatRows.map(r => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;font-weight:500;">${r.name} mm</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;">${fmt(r.oldPrice, 2)} €</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;color:#15803d;font-weight:600;">${fmt(r.newPrice, 2)} €</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;text-align:right;color:#b45309;font-weight:600;">+${fmt(r.pct, 1)}%</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="sr">
<head><meta charset="utf-8"><title>Najava korekcije cena CTP ploča</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#111827;padding:28px 32px;color:#ffffff;">
            <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px;">Gama United</div>
            <div style="font-size:22px;font-weight:700;">Najava korekcije cena CTP ploča</div>
            <div style="font-size:14px;color:#d1d5db;margin-top:6px;">Primena od ${EFFECTIVE_DATE}</div>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Poštovani partneri iz <strong>${target.name}</strong>,</p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
            Pre svega, želimo da Vam se iskreno zahvalimo na dugogodišnjoj saradnji i poverenju koje nam ukazujete.
            Vaša podrška je razlog zašto kontinuirano ulažemo u nove mašine, tehnologiju, edukaciju ljudi i digitalizaciju
            procesa — sve sa ciljem da Vam pružimo bržu, precizniju i pouzdaniju uslugu. Posebno cenimo što naše napore u
            unapređenju primećujete i podržavate.
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
            Nažalost, u periodu <strong>od februara do maja 2026.</strong> primili smo <strong>tri uzastopna povećanja
            nabavnih cena CTP ploča</strong> od strane naših dobavljača, kao posledica geopolitičkih okolnosti, rasta cena
            sirovina i poremećaja u lancima snabdevanja. Do sada smo te troškove apsorbovali u potpunosti, ne želeći da
            opteretimo naše klijente — međutim, dalje održavanje postojećih cena više nije ekonomski održivo.
          </p>

          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
            Iz tog razloga, sa žaljenjem Vas obaveštavamo da od <strong>${EFFECTIVE_DATE}</strong> godine
            <strong>korigujemo cene CTP ploča u proseku za ${fmt(avgIncreasePct, 1)}%</strong> za Vašu kompaniju.
            Procenat je izračunat na osnovu Vaše stvarne potrošnje i predstavlja minimum potreban da održimo kvalitet
            usluge i kontinuitet isporuke koji ste navikli.
          </p>

          <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:6px;margin:0 0 24px;">
            <div style="font-size:13px;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Prosečno povećanje za Vašu kompaniju</div>
            <div style="font-size:32px;font-weight:700;color:#b45309;">+${fmt(avgIncreasePct, 1)}%</div>
            <div style="font-size:13px;color:#78350f;margin-top:4px;">na osnovu ${fmt(totalPlates, 0)} ploča iz Vaše istorije porudžbina</div>
          </div>

          <h3 style="font-size:16px;margin:0 0 12px;color:#111827;">Pregled novih cena po formatima</h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb;font-weight:600;">Format</th>
                <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #e5e7eb;font-weight:600;">Stara cena</th>
                <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #e5e7eb;font-weight:600;">Nova cena</th>
                <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #e5e7eb;font-weight:600;">Rast</th>
              </tr>
            </thead>
            <tbody>${formatRowsHtml}</tbody>
          </table>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
            Želimo da naglasimo da je naš pristup raspodele korekcije <strong>fer i transparentan</strong> —
            klijenti sa većim obimom porudžbina imaju manji procentualni rast, dok je za manje porudžbine rast
            nešto veći, što odražava realnu strukturu troškova.
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
            I dalje ostajemo posvećeni da Vam pružimo najbolji odnos kvaliteta, brzine i cene na tržištu.
            Verujemo da ćete imati razumevanja za ovu neophodnu korekciju i nadamo se nastavku uspešne saradnje.
          </p>

          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">
            Ukoliko imate bilo kakvih pitanja ili želite detaljniji pregled cena, stojimo Vam na raspolaganju.
          </p>

          <p style="margin:24px 0 0;font-size:15px;line-height:1.6;">
            Srdačan pozdrav,<br>
            <strong>Gama United</strong>
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 32px;font-size:12px;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;">
          Gama United d.o.o. · Otona Župančiča · Beograd<br>
          Ova najava se odnosi isključivo na CTP ploče. Cene ostalih usluga ostaju nepromenjene.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    await sendMail({
      to: recipientEmail,
      subject: `[PREGLED] Najava korekcije cena CTP ploča — ${target.name}`,
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
