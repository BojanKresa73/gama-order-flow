import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { sendMail } from '../_shared/email-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[test-email] Starting test email function');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[test-email] Missing authorization header');
      return new Response(JSON.stringify({ success: false, error: 'Nedostaje autorizacija' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[test-email] User authentication failed:', userError);
      return new Response(JSON.stringify({ success: false, error: 'Neautorizovan' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[test-email] User authenticated:', user.id);

    // Check if user has admin or superuser role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superuser'])
      .single();

    if (roleError || !roleData) {
      console.error('[test-email] User does not have admin access:', user.id, roleError);
      return new Response(JSON.stringify({ success: false, error: 'Potreban je admin pristup' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[test-email] User has role:', roleData.role);

    // Parse request body
    const body = await req.json();
    const toEmail = body.to;

    if (!toEmail) {
      console.error('[test-email] Missing to parameter');
      return new Response(JSON.stringify({ success: false, error: 'Nedostaje email adresa' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[test-email] Sending test email to ${toEmail}`);

    const emailProvider = Deno.env.get('EMAIL_PROVIDER') || 'resend';
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #ffffff; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Test Email - Gama United</h1>
            </div>
            <div class="content">
              <p>Poštovani,</p>
              <p>Ovo je testna poruka da proverite da li email konfiguracija ispravno funkcioniše.</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Detalji konfiguracije:</h3>
                <ul>
                  <li><strong>Email Provider:</strong> ${emailProvider}</li>
                  <li><strong>From Email:</strong> ${Deno.env.get('FROM_EMAIL')}</li>
                  <li><strong>Reply-To Email:</strong> ${Deno.env.get('REPLY_TO')}</li>
                </ul>
              </div>
              <p>Ako primate ovu poruku, email sistem je uspešno konfigurisan i radi kako treba.</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                Ova poruka je automatski generisana iz sistema.<br>
                Vreme slanja: ${new Date().toLocaleString('sr-RS')}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await sendMail({
        to: toEmail,
        subject: 'Test Email - Gama United',
        html: emailHtml,
        text: `Test Email - Gama United\n\nAko primate ovu poruku, email sistem je uspešno konfigurisan.`,
      });

      console.log('[test-email] Email sent successfully to', toEmail);

      return new Response(
        JSON.stringify({ 
          ok: true,
          success: true, 
          message: `Test email uspešno poslat na ${toEmail}`,
          provider: emailProvider
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } catch (emailError: any) {
      console.error('[test-email] Email sending error:', emailError);
      return new Response(
        JSON.stringify({ 
          ok: false,
          success: false, 
          error: `Greška pri slanju: ${emailError.message}` 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

  } catch (error: any) {
    console.error('[test-email] Error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false,
        success: false, 
        error: `Greška: ${error.message}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
