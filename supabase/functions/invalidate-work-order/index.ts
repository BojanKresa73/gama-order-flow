import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserRole } from "../_shared/roles.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { work_order_id, reason } = await req.json();
    if (!work_order_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing work_order_id" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const role = await getUserRole(supabase, user.id);
    if (!["superuser", "admin"].includes(role)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden" }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set invalid meta
    const { data: updated, error: upErr } = await supabase
      .from("work_orders")
      .update({
        invalidated_at: new Date().toISOString(),
        invalidated_by: user.id,
        invalid_reason: reason ?? null
      })
      .eq("id", work_order_id)
      .is("deleted_at", null)
      .select()
      .maybeSingle();

    if (upErr) throw upErr;
    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not found" }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Audit
    await supabase.from("work_order_events").insert({
      work_order_id,
      event_type: "invalidate",
      payload: { reason },
      created_by: user.id
    });

    // Notify portal users about invalidation (fire and forget)
    try {
      const serviceSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const orderLabel = updated.display_order_number || updated.order_code || work_order_id;
      await serviceSupabase.from('portal_notifications').insert({
        client_id: updated.client_id,
        work_order_id,
        event_type: 'invalidated',
        title: `Nalog ${orderLabel} storniran`,
        message: reason ? `Razlog: ${reason}` : 'Nalog je storniran.',
      });
    } catch (notifyErr) {
      console.error('Portal notification on invalidate failed:', notifyErr);
    }

    return new Response(
      JSON.stringify({ ok: true }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in invalidate-work-order:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
