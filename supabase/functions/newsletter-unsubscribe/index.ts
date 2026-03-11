import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HTML_SUCCESS = `<!DOCTYPE html>
<html lang="sr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Odjava sa mailing liste</title>
<style>body{margin:0;padding:40px 20px;background:#f8f9fa;font-family:Arial,sans-serif;text-align:center;}
.card{max-width:480px;margin:60px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);}
h1{color:#1a2366;font-size:24px;margin-bottom:16px;}
p{color:#666;font-size:16px;line-height:1.6;}
.check{font-size:48px;margin-bottom:16px;}
</style></head>
<body><div class="card">
<div class="check">✅</div>
<h1>Uspešno ste se odjavili</h1>
<p>Vaša email adresa je uklonjena sa naše mailing liste. Više nećete primati newsletter poruke od Gama United.</p>
</div></body></html>`;

const HTML_ERROR = `<!DOCTYPE html>
<html lang="sr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Greška</title>
<style>body{margin:0;padding:40px 20px;background:#f8f9fa;font-family:Arial,sans-serif;text-align:center;}
.card{max-width:480px;margin:60px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);}
h1{color:#c0392b;font-size:24px;margin-bottom:16px;}
p{color:#666;font-size:16px;line-height:1.6;}
</style></head>
<body><div class="card">
<h1>Greška pri odjavi</h1>
<p>Nismo mogli da obradimo vaš zahtev. Link je možda istekao ili je nevažeći.</p>
</div></body></html>`;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(HTML_ERROR, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Handle both GET (link click) and POST (RFC 8058 one-click)
  const { data, error } = await supabase
    .from("newsletter_recipients")
    .update({ is_active: false })
    .eq("unsubscribe_token", token)
    .select("email")
    .maybeSingle();

  if (error || !data) {
    console.error("Unsubscribe error:", error);
    // For POST (one-click), return 200 even on error per RFC 8058
    if (req.method === "POST") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    return new Response(HTML_ERROR, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  console.log(`Unsubscribed: ${data.email}`);

  // RFC 8058: POST returns 200 with no body
  if (req.method === "POST") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET: show confirmation page
  return new Response(HTML_SUCCESS, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
