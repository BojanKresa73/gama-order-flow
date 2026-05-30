// Internal helper: send arbitrary HTML to a single recipient via Resend.
// Protected by a fixed shared secret to avoid abuse. Used for newsletter previews.
import { Resend } from "https://esm.sh/resend@3.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-secret",
};

const FIXED_SECRET = "newsletter_preview_2026_v1_xz9q";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const provided = req.headers.get("x-test-secret") || new URL(req.url).searchParams.get("secret");
    if (provided !== FIXED_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) throw new Error("Missing to/subject/html");

    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
    const from = Deno.env.get("FROM_EMAIL")!;
    const cleanHtml = String(html).replace("<!-- UNSUB_PLACEHOLDER -->", "");

    const result = await resend.emails.send({
      from, to: [to], subject, html: cleanHtml,
    });
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, id: result.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
