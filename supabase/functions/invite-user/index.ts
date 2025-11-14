import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Invite user function called");
    
    const body = await req.json();
    const { email, full_name, app_role } = body ?? {};

    if (!email || !app_role) {
      console.error("Missing required fields:", { email, app_role });
      return new Response(
        JSON.stringify({ error: "email i app_role su obavezni" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Creating user:", { email, full_name, app_role });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Kreiraj korisnika (bez lozinke, poslaćemo recovery link)
    const { data: created, error: errCreate } = await admin.auth.admin.createUser({
      email,
      user_metadata: { full_name: full_name || email },
      email_confirm: true,
    });
    
    if (errCreate) {
      console.error("Error creating user:", errCreate);
      throw errCreate;
    }
    
    const user = created.user;
    console.log("User created successfully:", user.id);

    // 2) Upis u profiles i user_roles
    const { error: e1 } = await admin
      .from("profiles")
      .insert({ 
        id: user.id, 
        full_name: full_name || email, 
        is_active: true 
      });
    
    if (e1) {
      console.error("Error creating profile:", e1);
      throw e1;
    }

    const { error: e2 } = await admin
      .from("user_roles")
      .insert({ 
        user_id: user.id, 
        role: app_role 
      });
    
    if (e2) {
      console.error("Error assigning role:", e2);
      throw e2;
    }

    console.log("Profile and role assigned successfully");

    // 3) Pošalji link za postavljanje lozinke (recovery)
    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/reset-password`;
    
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    
    if (linkErr) {
      console.error("Error generating recovery link:", linkErr);
      throw linkErr;
    }

    console.log("Recovery link generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: user.id, 
        recovery_link: linkData?.properties?.action_link,
        message: "Korisnik uspešno kreiran. Recovery link možete poslati korisniku."
      }), 
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ 
        error: err.message || String(err),
        details: err 
      }), 
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
