import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilmItem {
  file_name: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  note?: string;
}

interface OpenFilmOrderRequest {
  client_id: string;
  client_email?: string;
  note?: string;
  items: FilmItem[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for all operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Nedostaje autorizacija' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Nevalidna autorizacija' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: OpenFilmOrderRequest = await req.json();

    // Validate payload
    if (!payload.client_id || !payload.items || payload.items.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Nedostaju obavezni podaci (client_id, items)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Opening film work order:', { 
      client_id: payload.client_id, 
      items_count: payload.items.length,
      user_id: user.id 
    });

    // Call compute-film-job to get calculations
    let computedItems: any[] = [];
    let hasComputeError = false;
    let computeError = '';

    try {
      const computeResponse = await supabase.functions.invoke('compute-film-job', {
        body: {
          roll_width_mm: 500,
          smart_rotation: false,
          waste_percent: 0,
          items: payload.items.map(item => ({
            file_name: item.file_name,
            width_mm: item.width_mm,
            height_mm: item.height_mm,
            quantity: item.quantity,
          })),
        },
      });

      if (computeResponse.error) {
        console.error('Compute error:', computeResponse.error);
        hasComputeError = true;
        computeError = computeResponse.error.message || 'Greška pri računanju';
      } else if (computeResponse.data?.items) {
        computedItems = computeResponse.data.items;
      } else {
        hasComputeError = true;
        computeError = 'Neispravan odgovor od compute funkcije';
      }
    } catch (e) {
      console.error('Exception calling compute-film-job:', e);
      hasComputeError = true;
      computeError = e instanceof Error ? e.message : 'Greška pri pozivu compute funkcije';
    }

    // Fallback computation if compute-film-job failed
    if (hasComputeError) {
      console.warn('Using fallback computation:', computeError);
      computedItems = payload.items.map((item) => {
        const m_per_piece = item.height_mm / 1000;
        const total_m = m_per_piece * item.quantity;
        return {
          file_name: item.file_name,
          m_per_piece: Number(m_per_piece.toFixed(4)),
          total_m: Number(total_m.toFixed(2)),
          used_width_mm: item.width_mm,
          rotation: 0,
          waste_m: 0,
        };
      });
    }

    // Get next work order number
    const currentYear = new Date().getFullYear();
    const { data: counterData, error: counterError } = await supabase.rpc(
      'increment_work_order_counter',
      { p_type: 'FILM', p_year: currentYear }
    );

    if (counterError) {
      console.error('Counter error:', counterError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Greška pri generisanju broja naloga' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serial = counterData as number;
    const orderNumber = `FILM-${currentYear}-${String(serial).padStart(6, '0')}`;

    // Create work order
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .insert({
        client_id: payload.client_id,
        order_type: 'film',
        type: 'FILM',
        status: 'open',
        created_by: user.id,
        order_number: orderNumber,
        display_order_number: orderNumber,
        serial: serial,
        year: currentYear,
        notes: payload.note,
      })
      .select()
      .single();

    if (workOrderError) {
      console.error('Work order error:', workOrderError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Greška pri kreiranju radnog naloga: ' + workOrderError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created work order:', workOrder.id);

    // Create film jobs
    const filmJobsToInsert = payload.items.map((item, index) => {
      const computed = computedItems[index];
      return {
        work_order_id: workOrder.id,
        file_name: item.file_name,
        width_mm: item.width_mm,
        height_mm: item.height_mm,
        qty: item.quantity,
        note: item.note,
        computed_m_per_piece: computed?.m_per_piece || 0,
        computed_total_m: computed?.total_m || 0,
        computed_rotation_deg: computed?.rotation || 0,
      };
    });

    const { error: filmJobsError } = await supabase
      .from('film_jobs')
      .insert(filmJobsToInsert);

    if (filmJobsError) {
      console.error('Film jobs error:', filmJobsError);
      // Try to delete the work order to maintain consistency
      await supabase.from('work_orders').delete().eq('id', workOrder.id);
      return new Response(
        JSON.stringify({ ok: false, error: 'Greška pri kreiranju stavki: ' + filmJobsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate summary
    const totalM = computedItems.reduce((sum, item) => sum + (item.total_m || 0), 0);
    const totalWasteM = computedItems.reduce((sum, item) => sum + (item.waste_m || 0), 0);

    console.log('Film work order created successfully:', {
      order_id: workOrder.id,
      order_number: orderNumber,
      total_m: totalM,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        work_order_id: workOrder.id,
        order_number: orderNumber,
        items: computedItems,
        summary: {
          total_m: Number(totalM.toFixed(2)),
          waste_m: Number(totalWasteM.toFixed(2)),
          items_count: payload.items.length,
        },
        warn: hasComputeError ? `Fallback proračun korišćen: ${computeError}` : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in open-film-work-order:', error);
    const message = error instanceof Error ? error.message : 'Nepoznata greška';
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
