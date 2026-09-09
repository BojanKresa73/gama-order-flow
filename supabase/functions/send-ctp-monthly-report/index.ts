import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendMail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

const MIN_PLATES_YEAR = 5; // klijenti sa manje od ovoga se preskaču
const LOGO_URL =
  "https://ytophmlfbrnhmqtwpijn.supabase.co/storage/v1/object/public/newsletter-assets/gama-united-white.png";

interface MonthRow { month: string; plates: number }
interface FormatRow { month: string; format_name: string; plates: number }

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function monthIndex(iso: string) {
  return parseInt(iso.slice(5, 7), 10) - 1;
}

function pct(curr: number, prev: number): string | null {
  if (!prev) return null;
  const p = ((curr - prev) / prev) * 100;
  const sign = p >= 0 ? "+" : "−";
  return `${sign}${Math.abs(p).toFixed(1)}%`;
}

function buildHtml(opts: {
  clientName: string;
  year: number;
  upToMonth: number; // 0-based, poslednji prikazani mesec
  months: MonthRow[];
  formats: FormatRow[];
  prevYearMonths: MonthRow[];
  unsubscribeUrl: string | null;
  showIntro?: boolean;
}) {
  const { clientName, year, upToMonth, months, formats, prevYearMonths, unsubscribeUrl, showIntro } = opts;

  const byMonth = new Array(upToMonth + 1).fill(0);
  months.forEach((m) => {
    const i = monthIndex(m.month);
    if (i <= upToMonth) byMonth[i] = Number(m.plates) || 0;
  });

  const total = byMonth.reduce((a, b) => a + b, 0);
  const activeMonths = byMonth.filter((v) => v > 0).length || 1;
  const avg = Math.round(total / activeMonths);
  const last = byMonth[upToMonth] || 0;
  const prev = upToMonth > 0 ? byMonth[upToMonth - 1] : 0;
  const momText = pct(last, prev);

  // Isti mesec prošle godine (prikazuje se samo ako postoji podatak)
  const prevYearSame = prevYearMonths.find((m) => monthIndex(m.month) === upToMonth);
  const yoyText = prevYearSame ? pct(last, Number(prevYearSame.plates) || 0) : null;

  const max = Math.max(...byMonth, 1);
  const bars = byMonth
    .map((v, i) => {
      const h = Math.max(2, Math.round((v / max) * 140));
      return `
      <td align="center" valign="bottom" style="padding:0 4px;">
        <div style="font:bold 11px Arial,sans-serif;color:#1F4E79;margin-bottom:4px;">${v}</div>
        <div style="width:26px;height:${h}px;background:#1F4E79;border-radius:3px 3px 0 0;"></div>
        <div style="font:11px Arial,sans-serif;color:#666;padding-top:6px;">${MONTHS[i].slice(0, 3)}</div>
      </td>`;
    })
    .join("");

  // Tabela po formatima (samo ako klijent koristi više od jednog formata)
  const formatNames = [...new Set(formats.map((f) => f.format_name))].sort();
  let formatTable = "";
  if (formatNames.length > 1) {
    const grid = new Map<string, number>();
    formats.forEach((f) => {
      const i = monthIndex(f.month);
      if (i <= upToMonth) grid.set(`${i}|${f.format_name}`, Number(f.plates) || 0);
    });
    const head = formatNames
      .map((n) => `<th style="padding:8px;text-align:right;font:bold 12px Arial,sans-serif;">${esc(n)}</th>`)
      .join("");
    const rows = byMonth
      .map((v, i) => {
        const cells = formatNames
          .map((n) => {
            const val = grid.get(`${i}|${n}`) || 0;
            return `<td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font:13px Arial,sans-serif;">${val || "—"}</td>`;
          })
          .join("");
        return `<tr><td style="padding:8px;border-bottom:1px solid #eee;font:13px Arial,sans-serif;">${MONTHS[i]}</td>${cells}<td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font:bold 13px Arial,sans-serif;">${v}</td></tr>`;
      })
      .join("");
    formatTable = `
      <h3 style="font:bold 16px Arial,sans-serif;color:#1F4E79;margin:28px 0 10px;">Potrošnja po formatima ploča</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead><tr style="background:#1F4E79;color:#ffffff;">
          <th style="padding:8px;text-align:left;font:bold 12px Arial,sans-serif;">Mesec</th>
          ${head}
          <th style="padding:8px;text-align:right;font:bold 12px Arial,sans-serif;">Ukupno</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } else {
    const rows = byMonth
      .map(
        (v, i) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee;font:13px Arial,sans-serif;">${MONTHS[i]}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font:bold 13px Arial,sans-serif;">${v}</td></tr>`,
      )
      .join("");
    formatTable = `
      <h3 style="font:bold 16px Arial,sans-serif;color:#1F4E79;margin:28px 0 10px;">Potrošnja po mesecima</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead><tr style="background:#1F4E79;color:#ffffff;">
          <th style="padding:8px;text-align:left;font:bold 12px Arial,sans-serif;">Mesec</th>
          <th style="padding:8px;text-align:right;font:bold 12px Arial,sans-serif;">Ploča</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const summary = momText
    ? `U mesecu ${MONTHS[upToMonth].toLowerCase()} potrošili ste <strong>${last}</strong> ploča, što je <strong>${momText}</strong> u odnosu na prethodni mesec.`
    : `U mesecu ${MONTHS[upToMonth].toLowerCase()} potrošili ste <strong>${last}</strong> ploča.`;

  return `<!DOCTYPE html>
<html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#1a2366;padding:20px 24px;">
    <img src="${LOGO_URL}" alt="Gama United" height="42" style="height:42px;display:block;border:0;">
  </td></tr>
  <tr><td style="padding:24px;">
    <h2 style="font:bold 20px Arial,sans-serif;color:#1a2366;margin:0 0 4px;">Mesečni izveštaj potrošnje CTP ploča</h2>
    <p style="font:14px Arial,sans-serif;color:#666;margin:0 0 18px;">${esc(clientName)} &nbsp;|&nbsp; Januar – ${MONTHS[upToMonth]} ${year}.</p>
${
  showIntro
    ? `
    <div style="border:1px solid #dbe6f5;background:#ffffff;border-radius:8px;padding:16px 18px;margin:0 0 18px;">
      <p style="font:bold 15px Arial,sans-serif;color:#1a2366;margin:0 0 8px;">Poštovani saradnici,</p>
      <p style="font:14px Arial,sans-serif;color:#333;line-height:1.65;margin:0 0 10px;">
        U <strong>Gama United</strong> neprekidno radimo na podizanju nivoa usluge i na tome da saradnja sa nama bude
        jednostavnija, brža i transparentnija. U tom duhu uvodimo novu mogućnost: <strong>svakog prvog u mesecu</strong>
        dobijaćete automatski izveštaj o vašoj potrošnji CTP ploča, za sve mesece od januara do prethodnog meseca.
      </p>
      <p style="font:14px Arial,sans-serif;color:#333;line-height:1.65;margin:0 0 10px;">
        Cilj nam je da vam damo jasan i uvek dostupan uvid u sopstvenu potrošnju — radi lakših kalkulacija, planiranja
        nabavke, kontrole troškova i preciznijeg praćenja trendova u vašoj proizvodnji. Izveštaj sadrži pregled po
        mesecima, poređenje sa prethodnim mesecom, prosečnu i ukupnu potrošnju, a po potrebi i razradu po formatima ploča.
      </p>
      <p style="font:14px Arial,sans-serif;color:#333;line-height:1.65;margin:0;">
        Ispod se nalazi vaš prvi izveštaj. Ukoliko želite dodatne podatke ili drugačiji prikaz, javite nam — rado ćemo
        ga prilagoditi vašim potrebama.
      </p>
    </div>`
    : ""
}


    <div style="background:#eef3fa;border-left:4px solid #1F4E79;padding:12px 14px;border-radius:6px;font:14px Arial,sans-serif;color:#22314f;">
      ${summary}
    </div>

    <h3 style="font:bold 16px Arial,sans-serif;color:#1F4E79;margin:26px 0 10px;">Broj ploča po mesecima</h3>
    <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>${bars}</tr></table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-collapse:collapse;">
      <tr>
        <td style="padding:12px;background:#f7f9fc;border-radius:8px;font:13px Arial,sans-serif;color:#555;">
          Ukupno od početka godine<br><span style="font:bold 20px Arial,sans-serif;color:#1a2366;">${total} ploča</span>
        </td>
        <td width="12"></td>
        <td style="padding:12px;background:#f7f9fc;border-radius:8px;font:13px Arial,sans-serif;color:#555;">
          Prosečno mesečno<br><span style="font:bold 20px Arial,sans-serif;color:#1a2366;">${avg} ploča</span>
        </td>
      </tr>
    </table>
    ${
      yoyText
        ? `<p style="font:14px Arial,sans-serif;color:#22314f;margin:16px 0 0;">U odnosu na ${MONTHS[upToMonth].toLowerCase()} ${year - 1}. godine: <strong>${yoyText}</strong></p>`
        : ""
    }

    ${formatTable}

    <p style="font:13px Arial,sans-serif;color:#666;margin-top:26px;line-height:1.6;">
      Ako imate pitanja o izveštaju ili želite detaljniju analizu, slobodno nam se javite.
    </p>
    <p style="font:13px Arial,sans-serif;color:#1a2366;margin:0;"><strong>Gama United</strong> &nbsp;|&nbsp; bojan.kresovic@gamaunited.rs</p>
  </td></tr>
  <tr><td style="background:#f7f9fc;padding:14px 24px;font:11px Arial,sans-serif;color:#94a3b8;text-align:center;">
    Ovaj izveštaj dobijate jer koristite našu CTP uslugu.
    ${unsubscribeUrl ? ` <a href="${unsubscribeUrl}" style="color:#94a3b8;">Odjava</a>` : ""}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");

  try {
    const body = await req.json().catch(() => ({}));
    const { client_id, preview, preview_to, force, cron_secret } = body ?? {};

    // --- Autorizacija: CRON_SECRET ili superuser ---
    let authorized = false;
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeaderRaw = req.headers.get("Authorization") || "";
    if (cronSecret && (cron_secret === cronSecret || headerSecret === cronSecret)) {
      authorized = true;
    } else if (serviceKey && authHeaderRaw === `Bearer ${serviceKey}`) {
      authorized = true;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: role } = await userClient.rpc("current_user_role");
        authorized = role === "superuser" || role === "admin_plus";
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Period = prethodni mesec (po vremenu Beograda)
    const now = new Date();
    const belgrade = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Belgrade" }));
    let year = belgrade.getFullYear();
    let upToMonth = belgrade.getMonth() - 1; // prethodni mesec
    if (upToMonth < 0) {
      upToMonth = 11;
      year -= 1;
    }
    const period = `${year}-${String(upToMonth + 1).padStart(2, "0")}-01`;

    // Klijenti sa CTP potrošnjom u tekućoj godini
    let clientIds: string[] = [];
    if (client_id) {
      clientIds = [client_id];
    } else {
      const { data: ctpOrders, error: ordErr } = await sb
        .from("work_orders")
        .select("client_id")
        .eq("order_type", "ctp")
        .is("deleted_at", null)
        .is("invalidated_at", null)
        .gte("created_at", `${year}-01-01`)
        .limit(20000);
      if (ordErr) throw ordErr;
      clientIds = [...new Set((ctpOrders || []).map((o: any) => o.client_id).filter(Boolean))];
    }

    const results: any[] = [];

    for (const cid of clientIds) {
      try {
        // Već poslato za ovaj period?
        if (!preview && !force) {
          const { data: existing } = await sb
            .from("ctp_monthly_report_log")
            .select("id,status")
            .eq("client_id", cid)
            .eq("period", period)
            .maybeSingle();
          if (existing && existing.status === "sent") {
            results.push({ client_id: cid, skipped: "already_sent" });
            continue;
          }
        }

        const { data: client } = await sb
          .from("clients")
          .select("id,name,email,notification_email,notification_email_2,notification_email_3,is_blocked")
          .eq("id", cid)
          .maybeSingle();
        if (!client || client.is_blocked) {
          results.push({ client_id: cid, skipped: "no_client" });
          continue;
        }

        const { data: stats, error: statsErr } = await sb.rpc("get_client_ctp_monthly", {
          p_client_id: cid,
          p_year: year,
        });
        if (statsErr) throw statsErr;

        const months = ((stats as any)?.months || []) as MonthRow[];
        const formats = ((stats as any)?.formats || []) as FormatRow[];
        const totalYear = months
          .filter((m) => monthIndex(m.month) <= upToMonth)
          .reduce((s, m) => s + (Number(m.plates) || 0), 0);

        if (totalYear < MIN_PLATES_YEAR) {
          results.push({ client_id: cid, skipped: "below_threshold", plates: totalYear });
          continue;
        }

        const { data: prevStats } = await sb.rpc("get_client_ctp_monthly", {
          p_client_id: cid,
          p_year: year - 1,
        });
        const prevYearMonths = ((prevStats as any)?.months || []) as MonthRow[];

        // Primaoci: glavni mejl + notification mejlovi + aktivni kontakti
        const { data: contacts } = await sb
          .from("client_contacts")
          .select("email,is_active")
          .eq("client_id", cid);

        const candidates = [
          client.email,
          client.notification_email,
          client.notification_email_2,
          client.notification_email_3,
          ...(contacts || []).filter((c: any) => c.is_active !== false).map((c: any) => c.email),
        ]
          .map((e) => (e || "").trim().toLowerCase())
          .filter((e) => e && e.includes("@"));

        let recipients = [...new Set(candidates)];

        // Poštuj odjavu sa mailing liste
        if (recipients.length > 0) {
          const { data: optOut } = await sb
            .from("newsletter_recipients")
            .select("email,is_active,unsubscribe_token")
            .in("email", recipients);
          const inactive = new Set(
            (optOut || []).filter((r: any) => r.is_active === false).map((r: any) => r.email.toLowerCase()),
          );
          recipients = recipients.filter((e) => !inactive.has(e));
        }

        if (preview && preview_to) recipients = [preview_to];

        if (recipients.length === 0) {
          results.push({ client_id: cid, skipped: "no_recipients" });
          continue;
        }

        const html = buildHtml({
          clientName: client.name,
          year,
          upToMonth,
          months,
          formats,
          prevYearMonths,
          unsubscribeUrl: null,
        });

        const subject = `Mesečni izveštaj potrošnje CTP ploča — ${MONTHS[upToMonth]} ${year}.`;

        if (preview) {
          results.push({ client_id: cid, client: client.name, recipients, html_length: html.length });
          if (preview_to) {
            await sendMail({ to: recipients, subject: `[PREGLED] ${subject}`, html });
          }
          continue;
        }

        for (const to of recipients) {
          await sendMail({ to: [to], subject, html });
          await new Promise((r) => setTimeout(r, 1100));
        }

        await sb.from("ctp_monthly_report_log").upsert(
          { client_id: cid, period, status: "sent", recipients, error_message: null },
          { onConflict: "client_id,period" },
        );

        results.push({ client_id: cid, client: client.name, sent: recipients.length });
      } catch (e) {
        console.error("CTP monthly report failed for client", cid, e);
        if (!preview) {
          await sb.from("ctp_monthly_report_log").upsert(
            { client_id: cid, period, status: "failed", recipients: [], error_message: String(e) },
            { onConflict: "client_id,period" },
          );
        }
        results.push({ client_id: cid, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, period, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-ctp-monthly-report error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
