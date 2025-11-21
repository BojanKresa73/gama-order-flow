import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { generateDeliveryNotePDF } from "../_shared/delivery-note-pdf.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Nedostaje autorizacija');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Niste autentifikovani');

    const url = new URL(req.url);
    const workOrderId = url.searchParams.get('work_order_id');
    
    if (!workOrderId) {
      throw new Error('work_order_id je obavezan');
    }

    const { data: workOrder, error: fetchError } = await supabase
      .from('work_orders')
      .select('*, clients(name, pib)')
      .eq('id', workOrderId)
      .single();

    if (fetchError || !workOrder) {
      throw new Error('Radni nalog nije pronađen');
    }

    const { data: fileEntries } = await supabase
      .from('file_entries')
      .select('*, plate_formats(format_name)')
      .eq('work_order_id', workOrderId);

    const pdfBuffer = await generateDeliveryNotePDF(workOrder, fileEntries || []);

    // Generate filename matching work order number format
    const fileName = `Otpremnica-${workOrder.display_order_number || workOrder.order_number}.pdf`;
    
    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Došlo je do greške' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

serve(handler);
