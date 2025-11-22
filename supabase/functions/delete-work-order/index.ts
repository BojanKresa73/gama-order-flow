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
    const { work_order_id } = await req.json();
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
    if (role !== "superuser") {
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden - Only superuser can delete work orders" }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Soft delete - set deleted_at timestamp
    const { data: updated, error: updErr } = await supabase
      .from("work_orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", work_order_id)
      .is("deleted_at", null)
      .select()
      .maybeSingle();

    if (updErr) throw updErr;
    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: "Work order not found or already deleted" }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await supabase.from("work_order_events").insert({
      work_order_id,
      event_type: "soft_delete",
      payload: { deleted_by: user.id },
      created_by: user.id
    });

    return new Response(
      JSON.stringify({ ok: true }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in delete-work-order:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
