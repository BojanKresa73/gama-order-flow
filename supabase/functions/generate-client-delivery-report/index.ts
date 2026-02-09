import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportItem {
  delivery_number: string;
  work_order_number: string;
  client_name: string;
  closed_at: string;
  sent_at: string | null;
  items: Array<{ filename: string; quantity: number }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const clientName = url.searchParams.get("client_name");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");

    if (!clientName || !dateFrom || !dateTo) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: client_name, date_from, date_to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating report for ${clientName} from ${dateFrom} to ${dateTo}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Find matching client IDs
    const { data: clients, error: clientError } = await supabase
      .from("clients")
      .select("id, name")
      .ilike("name", `%${clientName}%`);
    
    if (clientError) throw clientError;
    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Klijent nije pronađen" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIds = clients.map(c => c.id);
    const resolvedClientName = clients[0].name;

    // 2) Fetch ALL closed work orders for this client in the date range
    const { data: workOrders, error: woError } = await supabase
      .from("work_orders")
      .select("id, display_order_number, order_code, order_number, kind, order_type, created_at, closed_at, job_name, run_quantity")
      .in("client_id", clientIds)
      .eq("status", "closed")
      .is("deleted_at", null)
      .gte("closed_at", dateFrom)
      .lte("closed_at", dateTo + "T23:59:59")
      .order("closed_at", { ascending: true })
      .range(0, 9999);

    if (woError) throw woError;

    if (!workOrders || workOrders.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nema zatvorenih naloga za dati period" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${workOrders.length} closed work orders`);

    // 3) Fetch items for all work orders in parallel batches
    const woIds = workOrders.map(wo => wo.id);
    const ctpWoIds = workOrders.filter(wo => (wo.kind || 'CTP') === 'CTP' && wo.order_type === 'ctp').map(wo => wo.id);
    const filmWoIds = workOrders.filter(wo => wo.order_type === 'film').map(wo => wo.id);
    const digitalWoIds = workOrders.filter(wo => wo.order_type === 'digital').map(wo => wo.id);

    const [ctpData, filmData, digitalData] = await Promise.all([
      ctpWoIds.length > 0
        ? supabase.from("file_entries").select("work_order_id, filename, quantity, plate_format_id").in("work_order_id", ctpWoIds).range(0, 49999)
        : { data: [] },
      filmWoIds.length > 0
        ? supabase.from("film_jobs").select("work_order_id, file_name, qty, computed_total_m").in("work_order_id", filmWoIds).range(0, 49999)
        : { data: [] },
      digitalWoIds.length > 0
        ? supabase.from("digital_jobs").select("work_order_id, file_name, qty, obim, computed_total_sheets").in("work_order_id", digitalWoIds).range(0, 49999)
        : { data: [] },
    ]);

    // Group items by work_order_id
    const itemsByWoId = new Map<string, Array<{ filename: string; quantity: number }>>();
    
    for (const item of (ctpData.data || [])) {
      if (!itemsByWoId.has(item.work_order_id)) itemsByWoId.set(item.work_order_id, []);
      itemsByWoId.get(item.work_order_id)!.push({
        filename: item.filename,
        quantity: item.quantity || 0,
      });
    }
    for (const item of (filmData.data || [])) {
      if (!itemsByWoId.has(item.work_order_id)) itemsByWoId.set(item.work_order_id, []);
      itemsByWoId.get(item.work_order_id)!.push({
        filename: item.file_name,
        quantity: item.qty || 0,
      });
    }
    for (const item of (digitalData.data || [])) {
      if (!itemsByWoId.has(item.work_order_id)) itemsByWoId.set(item.work_order_id, []);
      itemsByWoId.get(item.work_order_id)!.push({
        filename: item.file_name,
        quantity: item.computed_total_sheets || (item.obim || 1) * (item.qty || 1),
      });
    }

    // For "other" type orders, use job_name
    for (const wo of workOrders) {
      if (wo.order_type === 'other' && !itemsByWoId.has(wo.id)) {
        itemsByWoId.set(wo.id, [{
          filename: wo.job_name || 'Usluga',
          quantity: wo.run_quantity || 1,
        }]);
      }
    }

    // 4) Build report items from work orders
    const reportItems: ReportItem[] = workOrders.map(wo => ({
      delivery_number: wo.display_order_number || wo.order_code || wo.order_number,
      work_order_number: wo.display_order_number || wo.order_code || wo.order_number,
      client_name: resolvedClientName,
      closed_at: wo.closed_at,
      sent_at: null,
      items: itemsByWoId.get(wo.id) || [],
    }));

    console.log(`Generating PDF with ${reportItems.length} entries`);

    // 5) Generate PDF
    const pdfBytes = await generatePDF(reportItems, resolvedClientName, dateFrom, dateTo);

    return new Response(pdfBytes as unknown as ArrayBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Otpremnice-${resolvedClientName.replace(/[^a-zA-Z0-9]/g, '_')}-${dateFrom}-${dateTo}_Izvestaj.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generatePDF(
  reportItems: ReportItem[],
  clientName: string,
  dateFrom: string,
  dateTo: string
): Promise<Uint8Array> {
  let totalItems = 0;
  let totalQuantity = 0;
  reportItems.forEach(ri => {
    totalItems += ri.items.length;
    ri.items.forEach(item => { totalQuantity += item.quantity || 0; });
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}.`;
  };

  const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 14;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addText = (text: string, size: number = 10, bold: boolean = false, indent: number = 0) => {
    if (y < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    const f = bold ? boldFont : font;
    const sanitizedText = text.replace(/[^\x00-\x7F]/g, (char) => {
      const replacements: Record<string, string> = {
        'č': 'c', 'ć': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj',
        'Č': 'C', 'Ć': 'C', 'Š': 'S', 'Ž': 'Z', 'Đ': 'Dj',
      };
      return replacements[char] || char;
    });
    page.drawText(sanitizedText.substring(0, 100), {
      x: margin + indent, y, size, font: f, color: rgb(0, 0, 0),
    });
    y -= lineHeight * (size / 10);
  };

  const addLine = () => {
    if (y < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawLine({
      start: { x: margin, y }, end: { x: pageWidth - margin, y },
      thickness: 0.5, color: rgb(0.5, 0.5, 0.5),
    });
    y -= 10;
  };

  // Header
  addText("IZVESTAJ O OTPREMNICAMA", 16, true);
  y -= 10;
  addText(`Klijent: ${clientName}`, 12, true);
  addText(`Period: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, 11);
  addText(`Generisano: ${formatDate(new Date().toISOString())}`, 10);
  y -= 10;
  addLine();
  y -= 5;

  addText(`UKUPNO NALOGA: ${reportItems.length}`, 12, true);
  addText(`UKUPNO STAVKI: ${totalItems}`, 11);
  addText(`UKUPNA KOLICINA: ${totalQuantity}`, 11);
  y -= 10;
  addLine();

  reportItems.forEach((ri, index) => {
    y -= 5;
    addText(`${index + 1}. ${ri.delivery_number}`, 11, true);
    addText(`Zatvoreno: ${formatDate(ri.closed_at)}`, 9, false, 15);

    ri.items.forEach((item) => {
      const filename = item.filename.length > 60 ? item.filename.substring(0, 57) + "..." : item.filename;
      addText(`- ${filename} - Kol: ${item.quantity || 0}`, 9, false, 25);
    });
    y -= 5;
  });

  return await pdfDoc.save();
}
