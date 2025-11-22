import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { generateWorkOrderPDF } from '../_shared/workorder-a4-pdf.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract work order ID from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const workOrderId = pathParts[pathParts.length - 1];

    if (!workOrderId) {
      return new Response(JSON.stringify({ error: 'Work order ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch work order with client details
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select(`
        *,
        clients (name, email, pib)
      `)
      .eq('id', workOrderId)
      .maybeSingle();

    if (woError || !workOrder) {
      console.error('Work order fetch error:', woError);
      return new Response(JSON.stringify({ error: 'Work order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch items based on work order type/kind
    let fileEntries: any[] = [];
    
    const orderKind = workOrder.kind || 'CTP';
    
    if (orderKind === 'CTP') {
      const { data, error } = await supabase
        .from('file_entries')
        .select('*, plate_formats(format_name)')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching CTP entries:', error);
      } else {
        fileEntries = data || [];
      }
    } else if (orderKind === 'FILMOVANJE') {
      const { data, error } = await supabase
        .from('film_jobs')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching film jobs:', error);
      } else {
        fileEntries = data || [];
      }
    } else if (orderKind === 'DIGITALA') {
      const { data, error } = await supabase
        .from('digital_jobs')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('order_index', { ascending: true });
      
      if (error) {
        console.error('Error fetching digital jobs:', error);
      } else {
        fileEntries = data || [];
      }
    }

    if (fileEntries.length === 0) {
      return new Response(JSON.stringify({ error: 'No items found for this work order' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate PDF
    const pdfBytes = await generateWorkOrderPDF(workOrder, fileEntries);

    const orderNumber = workOrder.display_order_number || workOrder.order_number || workOrderId;
    const filename = `RadniNalog_${orderNumber}.pdf`;

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error in print-work-order:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

serve(handler);
