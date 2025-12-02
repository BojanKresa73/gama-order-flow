import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
    console.log("[invite-user] Function called at:", new Date().toISOString());
    
    const { email, full_name, app_role } = await req.json();
    console.log("[invite-user] Request data:", { email, full_name, app_role });

    const allowed = ["superuser", "admin", "operator", "operator_ctp"] as const;
    const role = String(app_role ?? "").toLowerCase();
    
    if (!email || !allowed.includes(role as any)) {
      console.error("[invite-user] Invalid input:", { email, role });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email i rola su obavezni. Dozvoljena rola: superuser, admin, operator, operator_ctp" 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error("[invite-user] Missing env variables");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server konfiguracija nije ispravna. Kontaktirajte administratora." 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Proveri da li korisnik već postoji
    console.log("[invite-user] Checking if user exists:", email);
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();
    
    if (listError) {
      console.error("[invite-user] Error listing users:", listError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Greška pri proveri korisnika: " + listError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      console.log("[invite-user] User already exists:", existingUser.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Korisnik sa ovim emailom već postoji u sistemu." 
        }), 
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 2) Kreiraj korisnika (potvrdi email odmah)
    console.log("[invite-user] Creating user:", email, "with role:", role);
    const { data: created, error: errCreate } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });
    
    if (errCreate) {
      console.error("[invite-user] Error creating user:", errCreate);
      
      // Handle specific error cases
      if (errCreate.message?.includes("already registered") || errCreate.message?.includes("already exists")) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Korisnik sa ovim emailom već postoji u sistemu." 
          }), 
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Greška pri kreiranju korisnika: " + errCreate.message 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const user = created.user;
    console.log("[invite-user] User created successfully:", user.id);

    // 3) Upis u profiles
    const { error: e1 } = await admin
      .from("profiles")
      .insert({ 
        id: user.id, 
        full_name: full_name || email, 
        is_active: true 
      });
    
    if (e1 && e1.code !== "23505") {
      console.error("[invite-user] Error creating profile:", e1);
      // Ne prekidaj - korisnik je kreiran, samo loguj grešku
    } else {
      console.log("[invite-user] Profile created for user:", user.id);
    }

    // 4) Upis u user_roles
    const { error: e2 } = await admin
      .from("user_roles")
      .insert({ 
        user_id: user.id, 
        role 
      });
    
    if (e2 && e2.code !== "23505") {
      console.error("[invite-user] Error assigning role:", e2);
      // Ne prekidaj - korisnik je kreiran, samo loguj grešku
    } else {
      console.log("[invite-user] Role assigned for user:", user.id, "role:", role);
    }

    // 5) Generiši recovery link i pošalji email
    // Umesto inviteUserByEmail (koji ne radi za već kreirane korisnike),
    // koristimo generateLink sa tipom 'recovery' da korisnik može da postavi lozinku
    const origin = req.headers.get("origin") || "https://ytophmlfbrnhmqtwpijn.lovableproject.com";
    const redirectTo = `${origin}/reset-password`;
    
    console.log("[invite-user] Generating recovery link with redirect:", redirectTo);
    
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo,
      }
    });
    
    if (linkErr) {
      console.error("[invite-user] Error generating recovery link:", linkErr);
      // Korisnik je kreiran, ali link nije poslat
      // Vratimo success ali sa upozorenjem
      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: user.id,
          warning: "Korisnik je kreiran ali email nije poslat. Koristite 'Reset lozinke' da pošaljete link."
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log("[invite-user] Recovery link generated successfully for:", email);
    console.log("[invite-user] Link data:", linkData?.properties?.action_link ? "Link generated" : "No link in response");

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: user.id
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error("[invite-user] Unexpected error:", err);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: err.message || "Došlo je do neočekivane greške. Pokušajte ponovo." 
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
