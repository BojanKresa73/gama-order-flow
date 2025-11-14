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
    console.log("Admin reset password function called");
    
    const { email } = await req.json();
    
    if (!email) {
      console.error("Missing email");
      return new Response(
        JSON.stringify({ error: "Email je obavezan" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Generating recovery link for:", email);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Proveri da li korisnik postoji
    const { data: userData, error: userError } = await admin.auth.admin.listUsers();
    const userExists = userData?.users.some(u => u.email === email);
    
    if (!userExists) {
      console.error("User not found:", email);
      return new Response(
        JSON.stringify({ error: "Korisnik sa ovim email-om ne postoji" }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generiši recovery link
    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/reset-password`;
    
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    
    if (error) {
      console.error("Error generating recovery link:", error);
      throw error;
    }

    console.log("Recovery link generated successfully for:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recovery_link: data?.properties?.action_link,
        message: "Recovery link uspešno generisan"
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
        error: err.message || String(err) 
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
