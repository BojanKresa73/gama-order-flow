import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { filters } = await req.json();
    console.log('Generating CTP report with filters:', filters);

    // Fetch data
    let query = supabase
      .from("v_ctp_items" as any)
      .select("work_order_id, client_id, client_name, plate_format_name, plates_qty, closed_on");

    if (filters.dateRange?.from) {
      query = query.gte("closed_on", filters.dateRange.from);
    }
    if (filters.dateRange?.to) {
      query = query.lte("closed_on", filters.dateRange.to);
    }
    if (filters.clientIds?.length > 0) {
      query = query.in("client_id", filters.clientIds);
    }
    if (filters.plateFormatIds?.length > 0) {
      query = query.in("plate_format_id", filters.plateFormatIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data || []) as Array<{
      work_order_id: string;
      client_id: string;
      client_name: string;
      plate_format_name: string;
      plates_qty: number;
      closed_on: string;
    }>;

    // Calculate KPIs
    const totalPlates = items.reduce((sum, item) => sum + (item.plates_qty || 0), 0);
    const uniqueOrders = new Set(items.map(item => item.work_order_id)).size;
    const uniqueClients = new Set(items.map(item => item.client_id)).size;
    const avgPlatesPerOrder = uniqueOrders > 0 ? (totalPlates / uniqueOrders).toFixed(1) : "0.0";

    // Group by client for top clients
    const clientStats: Record<string, { name: string; plates: number; orders: Set<string> }> = {};
    items.forEach(item => {
      if (!clientStats[item.client_id]) {
        clientStats[item.client_id] = {
          name: item.client_name || "Nepoznato",
          plates: 0,
          orders: new Set(),
        };
      }
      clientStats[item.client_id].plates += item.plates_qty || 0;
      clientStats[item.client_id].orders.add(item.work_order_id);
    });

    const topClients = Object.values(clientStats)
      .sort((a, b) => b.plates - a.plates)
      .slice(0, 10);

    // Group by format
    const formatStats: Record<string, number> = {};
    items.forEach(item => {
      const format = item.plate_format_name || "Nepoznato";
      formatStats[format] = (formatStats[format] || 0) + (item.plates_qty || 0);
    });

    const topFormats = Object.entries(formatStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    let page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let yPosition = height - 50;

    // Title
    page.drawText('CTP Statistika - Izveštaj', {
      x: 50,
      y: yPosition,
      size: 24,
      font: timesRomanBoldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    // Date range
    const dateText = `Period: ${filters.dateRange?.from || 'N/A'} - ${filters.dateRange?.to || 'N/A'}`;
    page.drawText(dateText, {
      x: 50,
      y: yPosition,
      size: 12,
      font: timesRomanFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 40;

    // KPIs
    page.drawText('Ključni pokazatelji', {
      x: 50,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
    });
    yPosition -= 25;

    const kpis = [
      `Ukupno ploča: ${totalPlates}`,
      `Broj CTP naloga: ${uniqueOrders}`,
      `Prosečno ploča po nalogu: ${avgPlatesPerOrder}`,
      `Broj klijenata: ${uniqueClients}`,
    ];

    kpis.forEach(kpi => {
      page.drawText(kpi, {
        x: 70,
        y: yPosition,
        size: 12,
        font: timesRomanFont,
      });
      yPosition -= 20;
    });

    yPosition -= 20;

    // Top Clients
    page.drawText('Top 10 klijenata', {
      x: 50,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
    });
    yPosition -= 25;

    page.drawText('#  Klijent                                Ploča    Nalozi', {
      x: 70,
      y: yPosition,
      size: 10,
      font: timesRomanBoldFont,
    });
    yPosition -= 15;

    topClients.slice(0, 10).forEach((client, idx) => {
      const percentage = totalPlates > 0 ? ((client.plates / totalPlates) * 100).toFixed(1) : "0.0";
      const line = `${(idx + 1).toString().padEnd(3)}${client.name.substring(0, 35).padEnd(40)}${client.plates.toString().padStart(6)}   ${client.orders.size.toString().padStart(4)} (${percentage}%)`;
      page.drawText(line, {
        x: 70,
        y: yPosition,
        size: 9,
        font: timesRomanFont,
      });
      yPosition -= 15;
    });

    yPosition -= 20;

    // Top Formats
    if (yPosition < 150) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    page.drawText('Top 10 formata', {
      x: 50,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
    });
    yPosition -= 25;

    page.drawText('#  Format                               Ploča    %', {
      x: 70,
      y: yPosition,
      size: 10,
      font: timesRomanBoldFont,
    });
    yPosition -= 15;

    topFormats.slice(0, 10).forEach(([format, plates], idx) => {
      const percentage = totalPlates > 0 ? ((plates / totalPlates) * 100).toFixed(1) : "0.0";
      const line = `${(idx + 1).toString().padEnd(3)}${format.substring(0, 35).padEnd(40)}${plates.toString().padStart(6)}   ${percentage}%`;
      page.drawText(line, {
        x: 70,
        y: yPosition,
        size: 9,
        font: timesRomanFont,
      });
      yPosition -= 15;
    });

    // Footer
    const now = new Date();
    const footerText = `Generisano: ${now.toLocaleString('sr-RS')}`;
    page.drawText(footerText, {
      x: 50,
      y: 30,
      size: 8,
      font: timesRomanFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Upload to storage
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `reports/ctp/${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('ctp-reports')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('ctp-reports')
      .getPublicUrl(fileName);

    console.log('PDF generated successfully:', urlData.publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true,
        url: urlData.publicUrl,
        fileName: fileName,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error generating CTP report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
