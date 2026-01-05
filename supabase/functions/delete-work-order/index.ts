import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRes = { ok: boolean; error?: string };

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (status: number, body: JsonRes) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  try {
    const { work_order_id } = await req.json();
    if (!work_order_id) {
      return json(400, { ok: false, error: "Nedostaje work_order_id" });
    }

    // Create client with service role for authorization check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { ok: false, error: "Niste prijavljeni" });
    }

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json(401, { ok: false, error: "Nevažeći token" });
    }

    // Check if user is superuser using RPC
    const { data: isSuperuser, error: suErr } = await supabase.rpc('is_superuser', { 
      p_uid: user.id 
    });
    
    if (suErr) {
      console.error('Auth RPC error:', suErr);
      return json(500, { ok: false, error: `Greška pri proveri ovlašćenja: ${suErr.message}` });
    }
    
    if (!isSuperuser) {
      return json(403, { ok: false, error: "Samo superuser može da briše radne naloge" });
    }

    // Check if work order exists
    const { data: workOrder, error: findErr } = await supabase
      .from('work_orders')
      .select('id, display_order_number, order_number')
      .eq('id', work_order_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findErr) {
      console.error('Database error:', findErr);
      return json(500, { ok: false, error: `Greška u bazi: ${findErr.message}` });
    }
    
    if (!workOrder) {
      return json(404, { ok: false, error: "Radni nalog nije pronađen ili je već obrisan" });
    }

    // Hard delete - CASCADE will automatically delete all related records
    const { error: delErr } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', work_order_id);

    if (delErr) {
      console.error('Delete error:', delErr);
      return json(500, { ok: false, error: `Greška pri brisanju: ${delErr.message}` });
    }

    console.log(`Work order ${workOrder.order_number} deleted by user ${user.id}`);
    
    return json(200, { ok: true });
  } catch (e) {
    console.error('Error in delete-work-order:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return json(500, { ok: false, error: errorMessage });
  }
});
