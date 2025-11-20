import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

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

    // Validate SMTP environment variables
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    const archiveEmail = Deno.env.get('ARCHIVE_EMAIL');
    
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      console.error('[test-email] Missing SMTP configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Nedostaje SMTP konfiguracija' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!fromEmail) {
      console.error('[test-email] Missing FROM_EMAIL');
      return new Response(
        JSON.stringify({ success: false, error: 'Nedostaje FROM_EMAIL konfiguracija' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('[test-email] Using FROM_EMAIL:', fromEmail);

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

    // Check if user has admin or superuser role by querying user_roles table directly
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

    // Initialize SMTP client with STARTTLS for port 587
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort),
        tls: false, // Use STARTTLS for port 587, not direct TLS
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    // Send test email
    const emailContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Test Email - SMTP Konfiguracija</h1>
            <p>Poštovani,</p>
            <p>Ovo je testna poruka da proverite da li SMTP konfiguracija ispravno funkcioniše.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Detalji konfiguracije:</h3>
              <ul>
                <li><strong>SMTP Host:</strong> ${smtpHost}</li>
                <li><strong>SMTP Port:</strong> ${smtpPort}</li>
                <li><strong>From Email:</strong> ${fromEmail}</li>
                <li><strong>Archive Email:</strong> ${archiveEmail || 'Nije podešen'}</li>
              </ul>
            </div>
            <p>Ako primate ovu poruku, SMTP je uspešno konfigurisan i radi kako treba.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
              Ova poruka je automatski generisana iz sistema.<br>
              Vreme slanja: ${new Date().toLocaleString('sr-RS')}
            </p>
          </div>
        </body>
      </html>
    `;

    await client.send({
      from: fromEmail,
      to: toEmail,
      replyTo: archiveEmail || fromEmail,
      subject: 'Test Email - SMTP Konfiguracija',
      content: 'Ovo je testna poruka za proveru SMTP konfiguracije.',
      html: emailContent,
    });

    await client.close();

    console.log('[test-email] Email sent successfully to', toEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email uspešno poslat na ${toEmail}` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

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
