import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@resend.dev";
    
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

    // Generiši recovery link - koristi frontend URL
    const FRONTEND_URL = Deno.env.get("SITE_URL") || "https://gama-order-flow.lovable.app";
    const redirectTo = FRONTEND_URL;
    
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    
    if (error) {
      console.error("Error generating recovery link:", error);
      throw error;
    }

    const recoveryLink = data?.properties?.action_link;
    console.log("Recovery link generated successfully for:", email);

    // Pošalji email putem Resend
    if (RESEND_API_KEY && recoveryLink) {
      const resend = new Resend(RESEND_API_KEY);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Gama United</h1>
            </div>
            <div class="content">
              <h2>Resetovanje lozinke</h2>
              <p>Poštovani,</p>
              <p>Primili smo zahtev za resetovanje vaše lozinke. Kliknite na dugme ispod da biste postavili novu lozinku:</p>
              <p style="text-align: center;">
                <a href="${recoveryLink}" class="button">Resetuj lozinku</a>
              </p>
              <p>Ako niste vi zatražili resetovanje lozinke, ignorišite ovaj email.</p>
              <p style="color: #64748b; font-size: 12px;">Link ističe za 24 sata.</p>
            </div>
            <div class="footer">
              <p>Gama United d.o.o.<br>Veljka Milićevića 2/10, 11000 Beograd<br>PIB: 114876455</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const { error: emailError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "Resetovanje lozinke - Gama United",
        html: htmlContent,
      });

      if (emailError) {
        console.error("Error sending email:", emailError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Greška pri slanju emaila: ${emailError.message}`,
            recovery_link: recoveryLink
          }), 
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log("Recovery email sent successfully to:", email);
    } else {
      console.warn("RESEND_API_KEY not configured, email not sent");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recovery_link: recoveryLink,
        message: "Email za resetovanje lozinke je poslat"
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
