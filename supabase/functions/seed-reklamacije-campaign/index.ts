// One-off helper: creates the "Reklamacije preko portala" campaign and queues
// one pending send row per active newsletter recipient (excluding unsubscribed).
// Actual sending is done by send-newsletter-batch via pg_cron (throttled).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { REKLAMACIJE_HTML } from "../_shared/reklamacije-newsletter-html.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SECRET = "newsletter_batch_secret_2026_v1_xz9q";
const SUBJECT = "Nova mogućnost: reklamacije prijavite direktno preko portala";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const provided = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
    if (provided !== SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reuse existing campaign with the same subject if present (idempotent)
    const { data: existing } = await supabase
      .from("newsletter_campaigns").select("id").eq("subject", SUBJECT).maybeSingle();

    let campaignId = existing?.id as string | undefined;
    if (!campaignId) {
      const { data: created, error: cErr } = await supabase
        .from("newsletter_campaigns")
        .insert({ subject: SUBJECT, html_body: REKLAMACIJE_HTML, status: "draft" })
        .select("id").single();
      if (cErr) throw cErr;
      campaignId = created.id;
    } else {
      await supabase.from("newsletter_campaigns")
        .update({ html_body: REKLAMACIJE_HTML }).eq("id", campaignId);
    }

    // Load all active recipients (paginated)
    const PAGE = 500;
    let recipients: any[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from("newsletter_recipients").select("id, email")
        .eq("is_active", true).range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      recipients = recipients.concat(data);
      if (data.length < PAGE) break;
    }

    // Existing send rows for this campaign
    const existingEmails = new Set<string>();
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from("newsletter_sends").select("recipient_email")
        .eq("campaign_id", campaignId).range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      data.forEach((r: any) => existingEmails.add(r.recipient_email));
      if (data.length < PAGE) break;
    }

    const missing = recipients.filter((r) => !existingEmails.has(r.email));
    for (let i = 0; i < missing.length; i += PAGE) {
      const chunk = missing.slice(i, i + PAGE).map((r) => ({
        campaign_id: campaignId,
        recipient_id: r.id,
        recipient_email: r.email,
        status: "pending",
      }));
      const { error } = await supabase.from("newsletter_sends").insert(chunk);
      if (error) throw error;
    }

    await supabase.from("newsletter_campaigns").update({
      total_recipients: recipients.length,
      status: "sending",
      sent_at: new Date().toISOString(),
    }).eq("id", campaignId);

    return new Response(JSON.stringify({
      campaign_id: campaignId,
      recipients: recipients.length,
      queued: missing.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("seed-reklamacije-campaign error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
