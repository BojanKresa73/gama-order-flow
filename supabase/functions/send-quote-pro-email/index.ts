// Send Quotes-Pro PDF via Resend. Reply-to = sender's email, BCC sender + archive.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { Resend } from 'npm:resend@3.5.0';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@resend.dev';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY nije konfigurisan' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { to, subject, text, html, pdfBase64, filename, senderName, senderEmail } = body as {
      to: string; subject: string; text?: string; html?: string;
      pdfBase64: string; filename: string;
      senderName?: string; senderEmail?: string;
    };

    if (!to || !subject || !pdfBase64 || !filename) {
      return new Response(JSON.stringify({ error: 'Nedostaju polja (to, subject, pdfBase64, filename)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanName = (senderName || 'Gama United').replace(/["\r\n<>]/g, '').trim();
    const from = `${cleanName} <${FROM_EMAIL}>`;

    const bcc: string[] = [];
    if (senderEmail) bcc.push(senderEmail);
    if (ARCHIVE_EMAIL && !bcc.includes(ARCHIVE_EMAIL)) bcc.push(ARCHIVE_EMAIL);

    const resend = new Resend(RESEND_API_KEY);
    const htmlBody = html || `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;">${(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</pre>`;

    const result = await resend.emails.send({
      from,
      to: [to],
      bcc: bcc.length > 0 ? bcc : undefined,
      reply_to: senderEmail || undefined,
      subject,
      text: text || undefined,
      html: htmlBody,
      attachments: [{ filename, content: pdfBase64 }],
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('send-quote-pro-email error:', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
