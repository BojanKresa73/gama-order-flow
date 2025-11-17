import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateWorkOrderInput {
  client_id: string;
  type: 'CTP' | 'DIGITAL' | 'FILM' | 'OSTALO';
  order_type: string;
  job_name?: string;
  notes?: string;
  print_format?: string;
  binding?: string;
  print_spec?: string;
  lamination?: string;
  film_note?: string;
  kind?: string;
}

const prefixFor = (t?: string) => ({
  'CTP': 'CTP',
  'DIGITAL': 'DIG',
  'FILM': 'FILM',
  'OSTALO': 'OST',
}[t || ''] ?? 'WO');

async function getNextSerial(
  supabase: any,
  type: string,
  year: number
): Promise<number> {
  console.log(`Getting next serial for type: ${type}, year: ${year}`);
  
  // Use INSERT ... ON CONFLICT to atomically increment counter
  // If row doesn't exist, insert with serial=1
  // If row exists, increment last_serial and return new value
  const { data, error } = await supabase.rpc('increment_work_order_counter', {
    p_type: type,
    p_year: year,
  });

  if (error) {
    console.error('Error incrementing counter:', error);
    throw error;
  }

  const nextSerial = data;
  console.log(`Next serial: ${nextSerial}`);
  return nextSerial;
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

    // Insert work order with retry logic for serial conflicts
    let workOrder;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const { data, error } = await supabase
          .from('work_orders')
          .insert({
            client_id: input.client_id,
            type: input.type,
            order_type: input.order_type,
            kind: input.kind || input.type,
            serial: nextSerial,
            year: year,
            order_code: orderCode,
            order_number: orderCode, // Keep for backwards compatibility
            job_name: input.job_name,
            notes: input.notes,
            print_format: input.print_format,
            binding: input.binding,
            print_spec: input.print_spec,
            lamination: input.lamination,
            film_note: input.film_note,
            created_by: user.id,
            status: 'open',
          })
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          
          // If unique constraint violation, retry with new serial
          if (error.code === '23505' && retries > 1) {
            console.log('Serial conflict detected, retrying...');
            retries--;
            const newSerial = await getNextSerial(supabase, input.type, year);
            const newOrderCode = `${prefixFor(input.type)}-${year}-${String(newSerial).padStart(4, '0')}`;
            console.log(`Retrying with new order code: ${newOrderCode}`);
            continue;
          }
          
          throw error;
        }

        workOrder = data;
        break;
      } catch (error) {
        if (retries <= 1) throw error;
        retries--;
      }
    }

    console.log(`Work order created successfully: ${workOrder.id}`);

    // Create work order event
    await supabase.from('work_order_events').insert({
      work_order_id: workOrder.id,
      event_type: 'created',
      created_by: user.id,
      metadata: {
        order_code: orderCode,
        type: input.type,
      },
    });

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

  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
