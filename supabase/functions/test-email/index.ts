import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import nodemailer from 'https://esm.sh/nodemailer@6.9.7';

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

    // Get SMTP config from environment
    const SMTP_HOST = Deno.env.get('SMTP_HOST');
    const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const SMTP_USER = Deno.env.get('SMTP_USER');
    const SMTP_PASS = Deno.env.get('SMTP_PASS');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'gamaunitedobavestenje@gmail.com';
    const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL') || 'novi.nalozi@gamaunited.rs';
    
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error('[test-email] Missing SMTP configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Nedostaje SMTP konfiguracija' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('[test-email] Using SMTP:', SMTP_HOST, 'Port:', SMTP_PORT, 'User:', SMTP_USER);
    console.log('[test-email] Using FROM_EMAIL:', FROM_EMAIL);

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

    console.log(`[test-email] Sending test email to ${toEmail} via Gmail SMTP`);

    // Create nodemailer transporter for Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // false for port 587 with STARTTLS
      requireTLS: true, // force TLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Test Email - Gmail SMTP Konfiguracija</h1>
            <p>Poštovani,</p>
            <p>Ovo je testna poruka da proverite da li Gmail SMTP konfiguracija ispravno funkcioniše.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Detalji konfiguracije:</h3>
              <ul>
                <li><strong>SMTP Host:</strong> ${SMTP_HOST}</li>
                <li><strong>SMTP Port:</strong> ${SMTP_PORT} (STARTTLS)</li>
                <li><strong>From Email:</strong> ${FROM_EMAIL}</li>
                <li><strong>Reply-To Email:</strong> ${ARCHIVE_EMAIL}</li>
                <li><strong>Email Service:</strong> Gmail SMTP</li>
              </ul>
            </div>
            <p>Ako primate ovu poruku, email sistem je uspešno konfigurisan i radi kako treba.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
              Ova poruka je automatski generisana iz sistema.<br>
              Vreme slanja: ${new Date().toLocaleString('sr-RS')}
            </p>
          </div>
        </body>
      </html>
    `;

    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to: toEmail,
        bcc: ARCHIVE_EMAIL, // Archive copy
        replyTo: ARCHIVE_EMAIL,
        subject: 'Test Email - Gmail SMTP Konfiguracija',
        html: emailHtml,
        text: `Test Email - Gmail SMTP Konfiguracija\n\nAko primate ovu poruku, email sistem je uspešno konfigurisan.`,
      });

      console.log('[test-email] Email sent successfully via Gmail SMTP to', toEmail);
      console.log('[test-email] Message ID:', info.messageId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Test email uspešno poslat na ${toEmail} preko Gmail SMTP`,
          messageId: info.messageId,
          smtp: {
            host: SMTP_HOST,
            port: SMTP_PORT,
            user: SMTP_USER
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } catch (smtpError: any) {
      console.error('[test-email] Gmail SMTP error:', smtpError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Greška pri slanju preko Gmail SMTP: ${smtpError.message}` 
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
        success: false, 
        error: `Greška pri slanju: ${error.message}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
