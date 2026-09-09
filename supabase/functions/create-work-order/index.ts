import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { Buffer } from "node:buffer";
// @ts-ignore
(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;
import { Resend } from "https://esm.sh/resend@2.0.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateWorkOrderInput {
  client_id: string;
  type: 'CTP' | 'DIGITAL' | 'FILM' | 'OSTALO';
  order_type: string;
  job_name?: string;
  run_quantity?: number;
  notes?: string;
  print_format?: string;
  binding?: string;
  print_spec?: string;
  lamination?: string;
  film_note?: string;
  kind?: string;
  prep_hours?: number;
  sales_rep_name?: string | null;
  sales_rep_email?: string | null;
}

const prefixFor = (t?: string) => ({
  'CTP': 'CTP',
  'DIGITAL': 'DIG',
  'FILM': 'FILM',
  'OSTALO': 'OST',
}[t || ''] ?? 'WO');

// UI type to database enum mapping
const UI_TO_DB_KIND: Record<string, 'CTP'|'DIGITALA'|'FILMOVANJE'|'RAZNO'> = {
  CTP: 'CTP',
  DIGITAL: 'DIGITALA',
  FILM: 'FILMOVANJE',
  OSTALO: 'RAZNO',
};

async function getNextSerial(
  supabase: any,
  type: string,
  year: number
): Promise<number> {
  const { data } = await supabase.rpc('increment_work_order_counter', {
    p_type: type,
    p_year: year,
  });
  return data;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Create Work Order Function Started ===');
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Separate service-role client (no user JWT override) for admin auth calls.
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      throw new Error('Unauthorized');
    }

    console.log(`User authenticated: ${user.id}`);

    // Parse request body
    const input: CreateWorkOrderInput = await req.json();
    console.log('Input received:', JSON.stringify(input, null, 2));

    // Validate required fields
    if (!input.client_id || !input.type || !input.order_type) {
      throw new Error('Missing required fields: client_id, type, order_type');
    }

    // Generate order code
    const year = new Date().getFullYear();
    const nextSerial = await getNextSerial(supabase, input.type, year);
    const orderCode = `${prefixFor(input.type)}-${year}-${String(nextSerial).padStart(4, '0')}`;
    
    console.log(`Generated order code: ${orderCode}`);

    // Insert work order
    const dbKind = UI_TO_DB_KIND[input.type] || input.type;
    
    const { data: workOrder, error: insertError } = await supabase
      .from('work_orders')
      .insert({
        client_id: input.client_id,
        type: input.type,
        order_type: input.order_type,
        kind: dbKind,
        serial: nextSerial,
        year: year,
        order_code: orderCode,
        order_number: orderCode, // Keep for backwards compatibility
        job_name: input.job_name,
        run_quantity: input.run_quantity,
        notes: input.notes,
        print_format: input.print_format,
        binding: input.binding,
        print_spec: input.print_spec,
        lamination: input.lamination,
        film_note: input.film_note,
        prep_hours: input.prep_hours || 0,
        sales_rep_name: input.sales_rep_name || null,
        sales_rep_email: input.sales_rep_email || null,
        created_by: user.id,
        status: 'open',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log(`Work order created successfully: ${workOrder.id}`);

    // Create work order event
    await supabase.from('work_order_events').insert({
      work_order_id: workOrder.id,
      event_type: 'created',
      created_by: user.id,
      payload: {
        order_code: orderCode,
        type: input.type,
      },
    });

    // Notify portal users (fire and forget)
    try {
      // Get client name for notification
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', input.client_id)
        .single();

      const clientName = client?.name || 'Klijent';
      const orderLabel = workOrder.display_order_number || orderCode;

      // Insert portal notification directly (service role)
      await supabase.from('portal_notifications').insert({
        client_id: input.client_id,
        work_order_id: workOrder.id,
        event_type: 'created',
        title: `Novi nalog ${orderLabel}`,
        message: `Kreiran je novi ${input.order_type} nalog za ${clientName}.`,
      });

      // Send email to portal users who have email_notifications_enabled
      const { data: portalUsers } = await supabase
        .from('client_portal_users')
        .select('user_id, full_name, email_notifications_enabled')
        .eq('client_id', input.client_id)
        .eq('is_active', true)
        .eq('email_notifications_enabled', true);

      if (portalUsers && portalUsers.length > 0) {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        const fromEmail = Deno.env.get('FROM_EMAIL') || 'notifications@resend.dev';

        if (resendApiKey) {
          const resend = new Resend(resendApiKey);

          for (const pu of portalUsers) {
            try {
              // Get user email from auth
              const { data: authUser } = await adminClient.auth.admin.getUserById(pu.user_id);
              const userEmail = authUser?.user?.email;
              if (!userEmail) continue;

              await resend.emails.send({
                from: fromEmail,
                to: [userEmail],
                subject: `Novi nalog ${orderLabel} - ${clientName}`,
                html: `
                  <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                      <h2 style="color: #1a1a1a;">Novi radni nalog</h2>
                      <p>Poštovani ${pu.full_name},</p>
                      <p>Kreiran je novi <strong>${input.order_type}</strong> nalog za <strong>${clientName}</strong>.</p>
                      <table style="border-collapse: collapse; margin: 16px 0;">
                        <tr>
                          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Broj naloga</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${orderLabel}</td>
                        </tr>
                        ${input.job_name ? `<tr>
                          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Naziv</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${input.job_name}</td>
                        </tr>` : ''}
                        <tr>
                          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tip</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${input.order_type}</td>
                        </tr>
                      </table>
                      <p>Možete pratiti realizaciju naloga na <a href="https://gama-order-flow.lovable.app/portal">Klijent Portalu</a>.</p>
                      <p style="color: #888; font-size: 12px; margin-top: 24px;">Ovo obaveštenje možete isključiti u podešavanjima portala.</p>
                    </body>
                  </html>
                `,
              });
              console.log(`Email sent to portal user ${userEmail} for order ${orderLabel}`);
            } catch (emailErr) {
              console.error(`Failed to email portal user ${pu.user_id}:`, emailErr);
            }
          }
        }
      }
    } catch (notifyErr) {
      console.error('Portal notification failed (non-blocking):', notifyErr);
    }

    console.log('=== Create Work Order Function Completed ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: workOrder 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('create-work-order error:', msg, { payload: await req.clone().json().catch(() => ({})) });
    return new Response(
      JSON.stringify({ ok: false, error: msg }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
