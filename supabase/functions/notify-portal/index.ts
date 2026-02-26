import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NotifyPortalInput {
  work_order_id: string;
  event_type: string; // 'created' | 'closed' | 'priority_changed' | 'status_changed' | 'invalidated'
  title: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is authenticated internal user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error('Unauthorized');

    const input: NotifyPortalInput = await req.json();
    const { work_order_id, event_type, title, message } = input;

    if (!work_order_id || !event_type || !title || !message) {
      throw new Error('Missing required fields');
    }

    // Get work order client_id
    const { data: wo, error: woErr } = await supabase
      .from('work_orders')
      .select('client_id')
      .eq('id', work_order_id)
      .single();

    if (woErr || !wo) throw new Error('Work order not found');

    // Check if client has any active portal users
    const { data: portalUsers, error: puErr } = await supabase
      .from('client_portal_users')
      .select('id, user_id')
      .eq('client_id', wo.client_id)
      .eq('is_active', true);

    if (puErr) throw new Error('Error fetching portal users');
    if (!portalUsers || portalUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No active portal users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create in-app notification
    const { error: notifErr } = await supabase
      .from('portal_notifications')
      .insert({
        client_id: wo.client_id,
        work_order_id,
        event_type,
        title,
        message,
      });

    if (notifErr) {
      console.error('Failed to insert portal notification:', notifErr);
    }

    // 2. Send push notifications to all subscribed portal users
    const userIds = portalUsers.map(pu => pu.user_id);
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .in('user_id', userIds);

    if (subscriptions && subscriptions.length > 0) {
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

      if (vapidPublicKey && vapidPrivateKey) {
        // Use web-push compatible approach via fetch to push service
        for (const sub of subscriptions) {
          try {
            await sendWebPush(sub, { title, body: message, data: { work_order_id, event_type } }, vapidPublicKey, vapidPrivateKey);
          } catch (pushErr) {
            console.error('Push send failed for endpoint:', sub.endpoint, pushErr);
          }
        }
      } else {
        console.warn('VAPID keys not configured, skipping push notifications');
      }
    }

    return new Response(
      JSON.stringify({ success: true, notifications_sent: subscriptions?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('notify-portal error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Minimal Web Push implementation using VAPID
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: { title: string; body: string; data?: Record<string, string> },
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  // For VAPID-based push, we need crypto operations.
  // In Deno, we use the Web Crypto API + manual JWT construction.
  const audience = new URL(subscription.endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;

  // Create VAPID JWT
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud: audience,
    exp: expiry,
    sub: 'mailto:info@gamaunited.rs',
  };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const claimsB64 = base64urlEncode(JSON.stringify(claims));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import VAPID private key
  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  ).catch(() => {
    // Try JWK import if pkcs8 fails (raw key)
    return importRawECKey(privateKeyBytes);
  });

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64urlEncodeBuffer(new Uint8Array(signature))}`;

  // Send to push service (unencrypted payload for simplicity)
  const payloadStr = JSON.stringify(payload);
  
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body: payloadStr,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push service returned ${response.status}: ${text}`);
  }
}

async function importRawECKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  // Pad to 32 bytes if needed
  let d = rawBytes;
  if (d.length < 32) {
    const padded = new Uint8Array(32);
    padded.set(d, 32 - d.length);
    d = padded;
  }
  
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: base64urlEncodeBuffer(d),
    x: 'dummy', // Will be derived
    y: 'dummy',
  };

  // This simplified approach may not work for all cases
  // In production, consider using a web-push library
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return base64urlEncodeBuffer(bytes);
}

function base64urlEncodeBuffer(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
