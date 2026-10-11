// READ-ONLY Minimax probe: lists organisations visible to the API user. Imports nothing, writes nothing.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Niste prijavljeni" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: allowed } = await db.rpc("has_finance_access" as any);
  if (!allowed) return json({ error: "Nemate pristup" }, 403);

  const env = (k: string) => Deno.env.get(k);
  const [cid, csec, user, pass] = ["MINIMAX_CLIENT_ID", "MINIMAX_CLIENT_SECRET", "MINIMAX_USERNAME", "MINIMAX_PASSWORD"].map(env);
  if (!cid || !csec || !user || !pass) return json({ error: "Minimax pristupni podaci nisu uneti" }, 400);

  const tokRes = await fetch("https://moj.minimax.rs/RS/AUT/oauth20/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: cid, client_secret: csec, username: user, password: pass, scope: "minimax.rs" }),
  });
  if (!tokRes.ok) return json({ error: `Prijava na Minimax nije uspela (${tokRes.status})`, detail: (await tokRes.text()).slice(0, 300) }, 502);
  const { access_token } = await tokRes.json();

  const orgRes = await fetch("https://moj.minimax.rs/RS/API/api/currentuser/orgs", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!orgRes.ok) return json({ error: `Čitanje organizacija nije uspelo (${orgRes.status})` }, 502);
  const orgs = await orgRes.json();
  const rows = (orgs?.Rows ?? orgs ?? []).map((o: any) => ({
    organisation_id: o.Organisation?.ID ?? o.ID,
    name: o.Organisation?.Name ?? o.Name,
    api_access: o.APIAccess,
    mobile_access: o.MobileAccess,
  }));
  return json({ organisations: rows });
});
