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

    console.log(`Batch PDF: fetching data for ${work_order_ids.length} work orders`);

    // Batch-fetch ALL work orders in one query
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('*, clients(name, pib)')
      .in('id', work_order_ids);
    
    if (woError) throw woError;
    if (!workOrders || workOrders.length === 0) throw new Error('Nijedan nalog nije pronađen');

    // Group work orders by kind for batch item fetching
    const woById = new Map(workOrders.map(wo => [wo.id, wo]));
    const ctpIds = workOrders.filter(wo => (wo.kind || 'CTP') === 'CTP').map(wo => wo.id);
    const filmIds = workOrders.filter(wo => wo.kind === 'FILMOVANJE').map(wo => wo.id);
    const digitalIds = workOrders.filter(wo => wo.kind === 'DIGITALA').map(wo => wo.id);
    const raznoIds = workOrders.filter(wo => wo.kind === 'RAZNO').map(wo => wo.id);

    // Batch-fetch all items in parallel (one query per type instead of per order)
    const itemsByWoId = new Map<string, any[]>();

    const [ctpData, filmData, digitalData] = await Promise.all([
      ctpIds.length > 0
        ? supabase.from('file_entries').select('*, plate_formats(format_name)').in('work_order_id', ctpIds).order('created_at', { ascending: true })
        : { data: [] },
      filmIds.length > 0
        ? supabase.from('film_jobs').select('*').in('work_order_id', filmIds).order('created_at', { ascending: true })
        : { data: [] },
      digitalIds.length > 0
        ? supabase.from('digital_jobs').select('*').in('work_order_id', digitalIds).order('order_index', { ascending: true })
        : { data: [] },
    ]);

    // Group items by work_order_id
    for (const item of (ctpData.data || [])) {
      if (!itemsByWoId.has(item.work_order_id)) itemsByWoId.set(item.work_order_id, []);
      itemsByWoId.get(item.work_order_id)!.push(item);
    }
    for (const item of (filmData.data || [])) {
      if (!itemsByWoId.has(item.work_order_id)) itemsByWoId.set(item.work_order_id, []);
      itemsByWoId.get(item.work_order_id)!.push(item);
    }
    for (const item of (digitalData.data || [])) {
      if (!itemsByWoId.has(item.work_order_id)) itemsByWoId.set(item.work_order_id, []);
      itemsByWoId.get(item.work_order_id)!.push(item);
    }
    // RAZNO: synthetic items
    for (const woId of raznoIds) {
      const wo = woById.get(woId)!;
      itemsByWoId.set(woId, [{
        id: wo.id,
        filename: wo.job_name || 'Usluga',
        quantity: wo.run_quantity || 1,
        file_type: 'ostalo'
      }]);
    }

    console.log(`Data fetched. Generating ${workOrders.length} PDFs...`);

    // Generate all individual PDFs
    const mergedPdf = await PDFDocument.create();
    let successCount = 0;
    const errors: string[] = [];

    // Process in order of provided IDs
    for (const woId of work_order_ids) {
      const wo = woById.get(woId);
      if (!wo) {
        errors.push(`${woId}: nije pronađen`);
        continue;
      }
      try {
        const items = itemsByWoId.get(woId) || [];
        const pdfBytes = await generateDeliveryNotePDF(wo, items);
        const individualPdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(individualPdf, individualPdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        successCount++;
      } catch (err: any) {
        console.error(`Error WO ${woId}:`, err.message);
        errors.push(`${woId}: ${err.message}`);
      }
    }

    if (successCount === 0) {
      throw new Error('Nijedna otpremnica nije generisana. ' + errors.join('; '));
    }

    console.log(`Done: ${successCount}/${work_order_ids.length} OK, ${errors.length} errors`);

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
