import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { fitOnRoll } from '../_shared/film-calculations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateWorkOrderRequest {
  workOrderId: string;
  kind: string;
  header: {
    client_id: string;
    notes?: string;
    job_name?: string;
    print_format?: string;
    binding?: string;
    print_spec?: string;
    lamination?: string;
    trial_print?: boolean;
    trial_sheets?: number;
  };
  items: {
    created: any[];
    updated: any[];
    deleted: string[];
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

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
      return new Response(
        JSON.stringify({ ok: false, error: 'Nevalidna autorizacija' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: UpdateWorkOrderRequest = await req.json();

    // Normalize kind
    const kindMap: Record<string, string> = {
      'CTP': 'CTP',
      'FILM': 'FILMOVANJE',
      'FILMOVANJE': 'FILMOVANJE',
      'DIGITAL': 'DIGITALA',
      'DIGITALA': 'DIGITALA',
      'OTHER': 'OSTALO',
      'OSTALO': 'OSTALO',
    };
    const normalizedKind = kindMap[payload.kind.toUpperCase()] || 'CTP';

    // Check work order exists and is open
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', payload.workOrderId)
      .eq('status', 'open')
      .single();

    if (woError || !workOrder) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Nalog nije pronađen ili je već zatvoren' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update work order header
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        ...payload.header,
        kind: normalizedKind,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.workOrderId);

    if (updateError) throw updateError;

    // Get table name for items
    let tableName = '';
    if (normalizedKind === 'CTP') tableName = 'file_entries';
    else if (normalizedKind === 'FILMOVANJE') tableName = 'film_jobs';
    else if (normalizedKind === 'DIGITALA') tableName = 'digital_jobs';
    else tableName = 'misc_jobs';

    // Handle item deletions
    if (payload.items.deleted && payload.items.deleted.length > 0) {
      await supabase
        .from(tableName)
        .delete()
        .in('id', payload.items.deleted)
        .eq('work_order_id', payload.workOrderId);
    }

    // Handle film recomputation
    if (normalizedKind === 'FILMOVANJE') {
      const { data: settings } = await supabase.from('film_settings').select('*').single();
      const rollWidth = settings?.roll_width_mm || 500;
      const marginMm = settings?.side_margin_mm || 0;
      const gapMm = settings?.gap_mm || 0;
      const wastePercent = settings?.waste_percent || 0;

      // Recompute created items
      for (const item of payload.items.created) {
        const result = fitOnRoll(
          item.width_mm,
          item.height_mm,
          item.quantity || item.qty,
          rollWidth,
          marginMm,
          gapMm,
          wastePercent / 100
        );

        await supabase.from('film_jobs').insert({
          work_order_id: payload.workOrderId,
          file_name: item.file_name,
          width_mm: item.width_mm,
          height_mm: item.height_mm,
          qty: item.quantity || item.qty,
          allow_rotate_90: item.allow_rotate_90 ?? true,
          margin_mm: item.margin_mm || 0,
          note: item.note,
          computed_rotation_deg: result.orientation,
          computed_m_per_piece: result.m_per_piece,
          computed_total_m: result.total_m,
          across_count: result.across,
          rows_needed: result.rows,
        });
      }

      // Recompute updated items
      for (const item of payload.items.updated) {
        const result = fitOnRoll(
          item.width_mm,
          item.height_mm,
          item.quantity || item.qty,
          rollWidth,
          marginMm,
          gapMm,
          wastePercent / 100
        );

        await supabase.from('film_jobs').update({
          file_name: item.file_name,
          width_mm: item.width_mm,
          height_mm: item.height_mm,
          qty: item.quantity || item.qty,
          allow_rotate_90: item.allow_rotate_90 ?? true,
          margin_mm: item.margin_mm || 0,
          note: item.note,
          computed_rotation_deg: result.orientation,
          computed_m_per_piece: result.m_per_piece,
          computed_total_m: result.total_m,
          across_count: result.across,
          rows_needed: result.rows,
        }).eq('id', item.id);
      }
    } else if (normalizedKind === 'CTP') {
      // Handle CTP items
      for (const item of payload.items.created) {
        await supabase.from('file_entries').insert({
          work_order_id: payload.workOrderId,
          filename: item.file_name,
          file_type: 'CTP',
          plate_format_id: item.plate_format_id || null,
          quantity: item.quantity || null,
        });
      }

      for (const item of payload.items.updated) {
        await supabase.from('file_entries').update({
          filename: item.file_name,
          plate_format_id: item.plate_format_id || null,
          quantity: item.quantity || null,
        }).eq('id', item.id);
      }
    } else if (normalizedKind === 'DIGITALA') {
      // Handle digital items with all new fields
      for (const item of payload.items.created) {
        await supabase.from('digital_jobs').insert({
          work_order_id: payload.workOrderId,
          name: item.name || null,
          file_name: item.file_name || '',
          finished_w_mm: item.finished_w_mm,
          finished_h_mm: item.finished_h_mm,
          qty: item.qty,
          pages: item.pages || 1,
          print_sides: item.print_sides,
          paper_type: item.paper_type || null,
          machine_sheet_format: item.machine_sheet_format || '330x488',
          pieces_per_sheet: item.pieces_per_sheet || null,
          pieces_per_sheet_override: item.pieces_per_sheet_override || null,
          test_sheets: item.test_sheets || 0,
          include_test_in_clicks: item.include_test_in_clicks || false,
          finishing: item.finishing || null,
          item_status: item.item_status || 'planned',
          is_test_print: item.is_test_print || false,
          computed_nup: item.computed_nup || null,
          computed_sheets_per_copy: item.computed_sheets_per_copy || null,
          computed_total_sheets: item.computed_total_sheets || null,
          computed_color_clicks: item.computed_color_clicks || null,
          computed_mono_clicks: item.computed_mono_clicks || null,
          computed_price_per_sheet: item.computed_price_per_sheet || null,
          computed_line_total: item.computed_line_total || null,
        });
      }

      for (const item of payload.items.updated) {
        await supabase.from('digital_jobs').update({
          name: item.name || null,
          file_name: item.file_name || '',
          finished_w_mm: item.finished_w_mm,
          finished_h_mm: item.finished_h_mm,
          qty: item.qty,
          pages: item.pages || 1,
          print_sides: item.print_sides,
          paper_type: item.paper_type || null,
          machine_sheet_format: item.machine_sheet_format || '330x488',
          pieces_per_sheet: item.pieces_per_sheet || null,
          pieces_per_sheet_override: item.pieces_per_sheet_override || null,
          test_sheets: item.test_sheets || 0,
          include_test_in_clicks: item.include_test_in_clicks || false,
          finishing: item.finishing || null,
          item_status: item.item_status || 'planned',
          is_test_print: item.is_test_print || false,
          computed_nup: item.computed_nup || null,
          computed_sheets_per_copy: item.computed_sheets_per_copy || null,
          computed_total_sheets: item.computed_total_sheets || null,
          computed_color_clicks: item.computed_color_clicks || null,
          computed_mono_clicks: item.computed_mono_clicks || null,
          computed_price_per_sheet: item.computed_price_per_sheet || null,
          computed_line_total: item.computed_line_total || null,
        }).eq('id', item.id);
      }
    }

    console.log('Work order updated successfully:', payload.workOrderId);

    return new Response(
      JSON.stringify({
        ok: true,
        workOrderId: payload.workOrderId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error in update-work-order:', message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});