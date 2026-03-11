import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<hr[^>]*>/gi, "\n---\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    // Get pending sends with recipient unsubscribe tokens
    const { data: sends, error: sendsErr } = await supabase
      .from("newsletter_sends")
      .select("*, newsletter_recipients!inner(unsubscribe_token, email)")
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
    const plainText = htmlToPlainText(campaign.html_body);
    let sentCount = 0;
    let failedCount = 0;

    // Unsubscribe URL base
    const unsubBaseUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe`;

    // Send emails one by one with delay (Resend free tier: 2 req/sec)
    const DELAY_BETWEEN_EMAILS_MS = 1100; // 1.1s between each email = safe under 2/sec

    for (let i = 0; i < sends.length; i++) {
      const send = sends[i] as any;
      
      // Retry logic for rate limits
      let maxAttempts = 3;
      let attempt = 0;
      let success = false;

      while (attempt < maxAttempts && !success) {
        attempt++;
        try {
          const recipientData = send.newsletter_recipients;
          const unsubToken = recipientData?.unsubscribe_token;
          const unsubUrl = `${unsubBaseUrl}?token=${unsubToken}`;

          const personalizedHtml = campaign.html_body.replace(
            "<!-- UNSUB_PLACEHOLDER -->",
            `<p style="color:rgba(255,255,255,0.5);font-size:11px;margin:8px 0 0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;"><a href="${unsubUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">Odjavi se sa mailing liste</a></p>`
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

          const result = await resend.emails.send(emailData);
          if (result.error) {
            const errObj = result.error as any;
            // If rate limited, wait and retry
            if (errObj.statusCode === 429) {
              console.log(`Rate limited on ${send.recipient_email}, attempt ${attempt}, waiting...`);
              await sleep(2000 * attempt);
              continue;
            }
            throw new Error(JSON.stringify(result.error));
          }

          await supabase
            .from("newsletter_sends")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", send.id);

          sentCount++;
          success = true;
        } catch (err) {
          if (attempt >= maxAttempts) {
            await supabase
              .from("newsletter_sends")
              .update({ status: "failed", error_msg: (err as Error).message })
              .eq("id", send.id);
            failedCount++;
          } else {
            await sleep(2000 * attempt);
          }
        }
      }

      // Rate limit delay between emails
      if (i < sends.length - 1) {
        await sleep(DELAY_BETWEEN_EMAILS_MS);
      }
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
