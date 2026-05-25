import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, getEmailConfig } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { recipient } = await req.json();
    if (!recipient || typeof recipient !== "string") {
      return new Response(JSON.stringify({ error: "recipient required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch CTP file entries with client + plate prices info
    const { data: entries, error } = await sb
      .from("file_entries")
      .select(`
        quantity,
        work_order:work_orders!inner(id, client_id, order_type, deleted_at, invalidated_at),
        client:work_orders!inner(client:clients!inner(id, name, email))
      `)
      .eq("file_type", "CTP")
      .range(0, 49999);

    if (error) throw error;

    // Get clients with prices
    const { data: pricedRows } = await sb
      .from("client_plate_prices")
      .select("client_id");
    const pricedSet = new Set((pricedRows || []).map((r: any) => r.client_id));

    // Get all clients
    const { data: clients } = await sb.from("clients").select("id, name, email");
    const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

    // Aggregate
    const agg = new Map<string, { plates: number; orders: Set<string> }>();
    for (const e of entries || []) {
      const wo: any = (e as any).work_order;
      if (!wo || wo.deleted_at || wo.invalidated_at || wo.order_type !== "ctp") continue;
      const cid = wo.client_id;
      if (pricedSet.has(cid)) continue;
      if (!agg.has(cid)) agg.set(cid, { plates: 0, orders: new Set() });
      const a = agg.get(cid)!;
      a.plates += (e as any).quantity || 0;
      a.orders.add(wo.id);
    }

    const rows = [...agg.entries()]
      .map(([cid, v]) => {
        const c: any = clientMap.get(cid) || {};
        return { name: c.name || "?", email: c.email || "", plates: v.plates, orders: v.orders.size };
      })
      .sort((a, b) => b.plates - a.plates);

    const tableRows = rows.map((r, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${r.name}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#666;">${r.email || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${r.plates}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${r.orders}</td>
      </tr>
    `).join("");

    const totalPlates = rows.reduce((s, r) => s + r.plates, 0);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;color:#222;">
        <h2 style="color:#1F4E79;">CTP klijenti BEZ definisanih cena ploča</h2>
        <p style="color:#555;">Lista klijenata koji imaju CTP potrošnju ali nemaju unete cene u cenovniku klijenta, pa nisu uključeni u analizu rasta cena.</p>
        <p><strong>Ukupno klijenata:</strong> ${rows.length} &nbsp;|&nbsp; <strong>Ukupno ploča:</strong> ${totalPlates}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
          <thead>
            <tr style="background:#1F4E79;color:white;">
              <th style="padding:10px;text-align:left;">#</th>
              <th style="padding:10px;text-align:left;">Klijent</th>
              <th style="padding:10px;text-align:left;">Email</th>
              <th style="padding:10px;text-align:right;">Ploča ukupno</th>
              <th style="padding:10px;text-align:right;">Naloga</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="margin-top:24px;color:#888;font-size:12px;">
          Napomena: Imena koja sadrže "škart", "Test" ili "GAMA United štampa" su interni zapisi i ne fakturišu se klijentima.
          Za ostale klijente preporučuje se da se unesu cene u cenovniku ploča kako bi bili obuhvaćeni narednom analizom rasta cena.
        </p>
        <p style="color:#888;font-size:12px;">— Gama United CTP Statistika</p>
      </div>
    `;

    const config = getEmailConfig();
    await sendEmail(config, {
      to: [recipient],
      subject: "CTP klijenti bez definisanih cena ploča",
      html,
    });

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
