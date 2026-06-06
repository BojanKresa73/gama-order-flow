import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { to, filename, contentBase64 } = await req.json();
    if (!to || !filename || !contentBase64) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Gama United <onboarding@resend.dev>';
    const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        bcc: ARCHIVE_EMAIL ? [ARCHIVE_EMAIL] : undefined,
        subject: 'Pregled povećanja cena po klijentima',
        html: `<p>Poštovani,</p><p>U prilogu se nalazi Excel tabela sa pregledom svih klijenata, starih i novih cena, i procentom povećanja (formula iz aplikacije).</p><p>Pozdrav,<br>Gama United</p>`,
        attachments: [{ filename, content: contentBase64 }],
      }),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: data }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true, id: data.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
