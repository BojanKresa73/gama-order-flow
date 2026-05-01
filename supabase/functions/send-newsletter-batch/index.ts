// Sends a small batch (default 40) of pending newsletter sends for a given campaign.
// Designed to be called repeatedly by pg_cron until no pending rows remain.
// Uses CRON_SECRET for auth (no JWT) so it can run unattended.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET")!;
    const provided = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = Deno.env.get("FROM_EMAIL")!;
    const replyTo = Deno.env.get("REPLY_TO");

    let body: any = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    const campaign_id: string | undefined = body.campaign_id;
    const batchSize: number = Math.min(Math.max(body.batch_size ?? 40, 1), 100);
    const delayMs: number = Math.max(body.delay_ms ?? 2500, 1100);

    if (!campaign_id) throw new Error("Missing campaign_id");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: campaign, error: campErr } = await supabase
      .from("newsletter_campaigns").select("*").eq("id", campaign_id).single();
    if (campErr || !campaign) throw new Error("Campaign not found");

    const { data: sends, error: sErr } = await supabase
      .from("newsletter_sends")
      .select("*, newsletter_recipients!inner(unsubscribe_token, email)")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .limit(batchSize);
    if (sErr) throw sErr;

    if (!sends || sends.length === 0) {
      // No pending: mark campaign sent (totals) and unschedule cron
      const { count: sentCnt } = await supabase
        .from("newsletter_sends").select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id).eq("status", "sent");
      const { count: failCnt } = await supabase
        .from("newsletter_sends").select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id).eq("status", "failed");
      await supabase.from("newsletter_campaigns").update({
        status: "sent", sent_count: sentCnt ?? 0, failed_count: failCnt ?? 0,
      }).eq("id", campaign_id);

      // Try to remove cron job for this campaign (best-effort)
      try {
        await supabase.rpc("execute_sql", { sql: `SELECT cron.unschedule('newsletter_${campaign_id}')` });
      } catch { /* ignore */ }

      return new Response(JSON.stringify({ done: true, sent: sentCnt, failed: failCnt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (campaign.status !== "sending") {
      await supabase.from("newsletter_campaigns").update({ status: "sending" }).eq("id", campaign_id);
    }

    const resend = new Resend(resendApiKey);
    const plainText = htmlToPlainText(campaign.html_body);
    const unsubBaseUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe`;

    let sent = 0, failed = 0;

    for (let i = 0; i < sends.length; i++) {
      const send: any = sends[i];
      try {
        const unsubToken = send.newsletter_recipients?.unsubscribe_token;
        const unsubUrl = `${unsubBaseUrl}?token=${unsubToken}`;

        const personalizedHtml = campaign.html_body.replace(
          "<!-- UNSUB_PLACEHOLDER -->",
          `<p style="color:rgba(255,255,255,0.5);font-size:11px;margin:8px 0 0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;"><a href="${unsubUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">Odjavi se sa mailing liste</a></p>`,
        );
        const personalizedText = plainText + `\n\n---\nOdjavi se: ${unsubUrl}`;

        const emailData: any = {
          from: fromEmail,
          to: [send.recipient_email],
          subject: campaign.subject,
          html: personalizedHtml,
          text: personalizedText,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Entity-Ref-ID": send.id,
            "Precedence": "bulk",
          },
        };
        if (replyTo) emailData.reply_to = replyTo;

        let attempt = 0, ok = false, lastErr: any = null;
        while (attempt < 3 && !ok) {
          attempt++;
          const result = await resend.emails.send(emailData);
          if (result.error) {
            const e: any = result.error;
            lastErr = e;
            if (e.statusCode === 429) { await sleep(2000 * attempt); continue; }
            throw new Error(JSON.stringify(e));
          }
          ok = true;
        }
        if (!ok) throw new Error(JSON.stringify(lastErr));

        await supabase.from("newsletter_sends")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", send.id);
        sent++;
      } catch (err) {
        await supabase.from("newsletter_sends")
          .update({ status: "failed", error_msg: (err as Error).message })
          .eq("id", send.id);
        failed++;
      }

      if (i < sends.length - 1) await sleep(delayMs);
    }

    return new Response(JSON.stringify({ done: false, batch_sent: sent, batch_failed: failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-newsletter-batch error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
