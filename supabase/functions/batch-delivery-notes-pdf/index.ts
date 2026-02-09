import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { generateDeliveryNotePDF } from "../_shared/delivery-note-pdf.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Nedostaje autorizacija');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Niste autentifikovani');

    const { work_order_ids } = await req.json();
    if (!work_order_ids || !Array.isArray(work_order_ids) || work_order_ids.length === 0) {
      throw new Error('work_order_ids je obavezan (niz ID-ova)');
    }

    if (work_order_ids.length > 100) {
      throw new Error('Maksimalno 100 naloga odjednom');
    }

    console.log(`Generating batch PDF for ${work_order_ids.length} work orders`);

    // Create merged PDF document
    const mergedPdf = await PDFDocument.create();

    let successCount = 0;
    const errors: string[] = [];

    for (const woId of work_order_ids) {
      try {
        // Fetch work order
        const { data: workOrder, error: fetchError } = await supabase
          .from('work_orders')
          .select('*, clients(name, pib)')
          .eq('id', woId)
          .single();

        if (fetchError || !workOrder) {
          errors.push(`${woId}: nije pronađen`);
          continue;
        }

        // Fetch items based on kind
        let fileEntries: any[] = [];
        const orderKind = workOrder.kind || 'CTP';

        if (orderKind === 'CTP') {
          const { data } = await supabase
            .from('file_entries')
            .select('*, plate_formats(format_name)')
            .eq('work_order_id', woId)
            .order('created_at', { ascending: true });
          fileEntries = data || [];
        } else if (orderKind === 'FILMOVANJE') {
          const { data } = await supabase
            .from('film_jobs')
            .select('*')
            .eq('work_order_id', woId)
            .order('created_at', { ascending: true });
          fileEntries = data || [];
        } else if (orderKind === 'DIGITALA') {
          const { data } = await supabase
            .from('digital_jobs')
            .select('*')
            .eq('work_order_id', woId)
            .order('order_index', { ascending: true });
          fileEntries = data || [];
        } else if (orderKind === 'RAZNO') {
          fileEntries = [{
            id: workOrder.id,
            filename: workOrder.job_name || 'Usluga',
            quantity: workOrder.run_quantity || 1,
            file_type: 'ostalo'
          }];
        }

        // Generate individual PDF
        const pdfBytes = await generateDeliveryNotePDF(workOrder, fileEntries);
        
        // Load and copy pages into merged document
        const individualPdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(individualPdf, individualPdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        
        successCount++;
      } catch (err: any) {
        console.error(`Error for WO ${woId}:`, err.message);
        errors.push(`${woId}: ${err.message}`);
      }
    }

    if (successCount === 0) {
      throw new Error('Nijedna otpremnica nije generisana. Greške: ' + errors.join('; '));
    }

    console.log(`Generated ${successCount}/${work_order_ids.length} delivery notes. Errors: ${errors.length}`);

    const mergedBytes = await mergedPdf.save();

    return new Response(mergedBytes as unknown as ArrayBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Otpremnice-batch-${successCount}.pdf"`,
        'X-Success-Count': String(successCount),
        'X-Error-Count': String(errors.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Batch PDF error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
