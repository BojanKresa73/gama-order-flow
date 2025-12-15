import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Drive API helpers
async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  
  if (!email || !privateKey) {
    throw new Error('Missing Google service account credentials');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Create JWT
  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Sign with RSA
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  const len = data.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  content: string,
  folderId: string
): Promise<{ id: string; name: string }> {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to Google Drive: ${error}`);
  }

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON secret for scheduled calls
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('x-cron-secret');
    
    // Allow both CRON calls and authenticated user calls
    let isCronCall = false;
    if (authHeader && cronSecret && authHeader === cronSecret) {
      isCronCall = true;
    }

    // If not a CRON call, verify user authentication
    if (!isCronCall) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authToken = req.headers.get('authorization')?.replace('Bearer ', '');
      
      if (!authToken) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user is superuser or admin
      const { data: roleData } = await supabaseAuth.rpc('has_any_role', {
        p_roles: ['superuser', 'admin']
      });
      
      if (!roleData) {
        return new Response(
          JSON.stringify({ error: 'Access denied: admin role required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Backup initiated - ${isCronCall ? 'CRON' : 'Manual'} call`);

    // Initialize Supabase with service role for data access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get folder ID
    const folderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');
    if (!folderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');
    }

    // Get Google access token
    console.log('Getting Google access token...');
    const accessToken = await getGoogleAccessToken();
    console.log('Access token obtained successfully');

    // Prepare backup data
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const backupData: Record<string, unknown> = {
      backup_timestamp: now.toISOString(),
      backup_type: 'full',
    };

    // Fetch all tables
    const tables = [
      'work_orders',
      'clients',
      'digital_jobs',
      'film_jobs',
      'file_entries',
      'delivery_notes',
      'large_format_orders',
      'large_format_jobs',
      'plate_formats',
      'inventory_history',
    ];

    for (const table of tables) {
      console.log(`Fetching ${table}...`);
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
        backupData[table] = { error: error.message };
      } else {
        backupData[table] = data;
        console.log(`${table}: ${data?.length || 0} records`);
      }
    }

    // Upload to Google Drive
    const fileName = `gama-backup-${timestamp}.json`;
    console.log(`Uploading ${fileName} to Google Drive...`);
    
    const uploadResult = await uploadToGoogleDrive(
      accessToken,
      fileName,
      JSON.stringify(backupData, null, 2),
      folderId
    );

    console.log('Backup uploaded successfully:', uploadResult.id);

    // Return summary
    const summary = {
      success: true,
      fileName: uploadResult.name,
      fileId: uploadResult.id,
      timestamp: now.toISOString(),
      tables: tables.map(t => ({
        name: t,
        records: Array.isArray(backupData[t]) ? (backupData[t] as unknown[]).length : 0,
      })),
    };

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Backup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: errorStack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
