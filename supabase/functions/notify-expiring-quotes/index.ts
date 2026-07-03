// Daily cron: notify quote creators when their quote expires in 3 days or 1 day
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@resend.dev';
const FROM = `Gama United <${FROM_EMAIL}>`;

const PUBLIC_URL = Deno.env.get('PUBLIC_APP_URL') ?? 'https://gama-order-flow.lovable.app';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) { console.warn('RESEND_API_KEY missing'); return { skipped: true }; }
  const body: Record<string, unknown> = { from: FROM, to: [to], subject, html };
  if (ARCHIVE_EMAIL) body.bcc = [ARCHIVE_EMAIL];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function processBucket(daysBefore: number) {
  const now = Date.now();
  const lower = new Date(now + (daysBefore - 0.5) * 86400000).toISOString();
  const upper = new Date(now + (daysBefore + 0.5) * 86400000).toISOString();

  const { data: quotes, error } = await admin
    .from('quotes')
    .select('id, quote_number, expires_at, created_by, client_id, clients(name)')
    .eq('status', 'sent')
    .gte('expires_at', lower)
    .lte('expires_at', upper);

  if (error) throw error;
  if (!quotes || quotes.length === 0) return { count: 0, sent: 0 };

  const ids = quotes.map((q: { id: string }) => q.id);
  const { data: alreadyNotified } = await admin
    .from('quote_expiry_notifications')
    .select('quote_id')
    .eq('days_before', daysBefore)
    .in('quote_id', ids);
  const skip = new Set((alreadyNotified ?? []).map((r: { quote_id: string }) => r.quote_id));

  let sent = 0;
  for (const q of quotes as any[]) {
    if (skip.has(q.id)) continue;
    const { data: userRes } = await admin.auth.admin.getUserById(q.created_by);
    const email = userRes?.user?.email;
    if (!email) continue;

    const clientName = q.clients?.name ?? '—';
    const expiresLocal = new Date(q.expires_at).toLocaleDateString('sr-RS');
    const url = `${PUBLIC_URL}/quotes-pro/${q.id}`;

    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="color:#b45309">Ponuda ističe za ${daysBefore} ${daysBefore === 1 ? 'dan' : 'dana'}</h2>
      <p>Ponuda <strong>${q.quote_number}</strong> za klijenta <strong>${clientName}</strong> ističe <strong>${expiresLocal}</strong>.</p>
      <p><a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Otvori ponudu</a></p>
    </div>`;

    try {
      await sendEmail(email, `Ponuda ${q.quote_number} ističe za ${daysBefore} ${daysBefore === 1 ? 'dan' : 'dana'}`, html);
      await admin.from('quote_expiry_notifications').insert({
        quote_id: q.id, days_before: daysBefore, recipient_email: email,
      });
      sent++;
    } catch (e) {
      console.error('send fail', q.id, e);
    }
  }
  return { count: quotes.length, sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await admin.rpc('expire_old_quotes' as any);
    const r3 = await processBucket(3);
    const r1 = await processBucket(1);
    return new Response(JSON.stringify({ success: true, days_3: r3, days_1: r1 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
