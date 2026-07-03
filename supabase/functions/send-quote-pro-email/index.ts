// Send Quotes-Pro PDF via Resend. Reply-to = sender's email, BCC sender + archive.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { Resend } from 'npm:resend@3.5.0';
import { z } from 'npm:zod@3.23.8';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@resend.dev';

const BodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  text: z.string().max(20000).optional(),
  html: z.string().max(200000).optional(),
  pdfBase64: z.string().min(100),
  filename: z.string().min(1).max(200),
  senderName: z.string().max(200).optional(),
  senderEmail: z.string().email().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY nije konfigurisan' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Neispravan zahtev', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { to, subject, text, html, pdfBase64, filename, senderName, senderEmail } = parsed.data;

    const cleanName = (senderName || 'Gama United').replace(/["\r\n<>]/g, '').trim();
    const from = `${cleanName} <${FROM_EMAIL}>`;

    const bcc: string[] = [];
    if (senderEmail) bcc.push(senderEmail);
    if (ARCHIVE_EMAIL && !bcc.includes(ARCHIVE_EMAIL)) bcc.push(ARCHIVE_EMAIL);

    const resend = new Resend(RESEND_API_KEY);
    const escapeHtml = (s: string) =>
      s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
    const htmlBody = html
      || `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;">${escapeHtml(text || '')}</pre>`;

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
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
