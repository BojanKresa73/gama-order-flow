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
    
    const { email, full_name, app_role } = await req.json();

    const allowed = ["superuser", "admin", "operator", "operator_ctp"] as const;
    const role = String(app_role ?? "").toLowerCase();
    
    if (!email || !allowed.includes(role as any)) {
      console.error("Invalid input:", { email, role });
      return new Response(
        JSON.stringify({ error: "email/role invalid" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Creating user:", email, "with role:", role);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Kreiraj korisnika (potvrdi email odmah da bi invite radio predvidivo)
    const { data: created, error: errCreate } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
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
    
    if (e1 && e1.code !== "23505") {
      console.error("Error creating profile:", e1);
      throw e1;
    }

    const { error: e2 } = await admin
      .from("user_roles")
      .insert({ 
        user_id: user.id, 
        role 
      });
    
    if (e2 && e2.code !== "23505") {
      console.error("Error assigning role:", e2);
      throw e2;
    }

    console.log("Profile and role assigned successfully");

    // 3) Pošalji pozivnicu (Supabase šalje mail)
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${new URL(req.url).origin}/reset-password`,
    });
    
    if (inviteErr) {
      console.error("Error sending invite:", inviteErr);
      throw inviteErr;
    }

    console.log("Invite sent successfully to:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: user.id
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
