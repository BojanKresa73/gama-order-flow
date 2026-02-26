import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = Deno.env.get("FROM_EMAIL")!;
    const replyTo = Deno.env.get("REPLY_TO");

    // Verify caller is superuser
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: roleData } = await supabaseUser.rpc("current_user_role");
    if (roleData !== "superuser") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) throw new Error("No user");

    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("Missing campaign_id");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get campaign
    const { data: campaign, error: campErr } = await supabase
      .from("newsletter_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent") throw new Error("Campaign already sent");

    // Get pending sends
    const { data: sends, error: sendsErr } = await supabase
      .from("newsletter_sends")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if (sendsErr) throw sendsErr;
    if (!sends || sends.length === 0) throw new Error("No pending sends");

    // Update campaign status
    await supabase
      .from("newsletter_campaigns")
      .update({ status: "sending", sent_by: user.id, sent_at: new Date().toISOString() })
      .eq("id", campaign_id);

    const resend = new Resend(resendApiKey);
    let sentCount = 0;
    let failedCount = 0;

    // Send emails in batches of 5
    for (let i = 0; i < sends.length; i += 5) {
      const batch = sends.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (send) => {
          try {
            const emailData: any = {
              from: fromEmail,
              to: [send.recipient_email],
              subject: campaign.subject,
              html: campaign.html_body,
            };
            if (replyTo) emailData.reply_to = replyTo;

            const result = await resend.emails.send(emailData);
            if (result.error) throw new Error(JSON.stringify(result.error));

            await supabase
              .from("newsletter_sends")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", send.id);

            sentCount++;
          } catch (err) {
            await supabase
              .from("newsletter_sends")
              .update({ status: "failed", error_msg: (err as Error).message })
              .eq("id", send.id);
            failedCount++;
          }
        })
      );
    }

    // Update campaign totals
    await supabase
      .from("newsletter_campaigns")
      .update({ status: "sent", sent_count: sentCount, failed_count: failedCount })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Newsletter error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
