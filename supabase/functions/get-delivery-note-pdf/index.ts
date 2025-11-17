import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}.`;
}

async function generateDeliveryNotePDF(
  workOrder: any,
  fileEntries: any[],
  deliveryNumber: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Fetch and embed Inter font for proper Serbian character support
  const fontUrl = 'https://raw.githubusercontent.com/rsms/inter/refs/heads/master/docs/font-files/Inter-Regular.ttf';
  const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
  const timesRomanFont = await pdfDoc.embedFont(fontBytes);
  const timesRomanBold = await pdfDoc.embedFont(fontBytes); // Using same font for now
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { height } = page.getSize();
  let yPosition = height - 50;

  page.drawText("GAMA UNITED d.o.o.", { x: 50, y: yPosition, size: 16, font: timesRomanBold, color: rgb(0, 0, 0) });
  yPosition -= 25;
  page.drawText("Šumadijska 29, 11000 Beograd", { x: 50, y: yPosition, size: 10, font: timesRomanFont });
  yPosition -= 15;
  page.drawText("PIB: 112345678 | MB: 21234567", { x: 50, y: yPosition, size: 10, font: timesRomanFont });
  yPosition -= 40;
  page.drawText("OTPREMNICA", { x: 50, y: yPosition, size: 18, font: timesRomanBold });
  yPosition -= 30;
  page.drawText(`Broj: ${deliveryNumber}`, { x: 50, y: yPosition, size: 12, font: timesRomanFont });
  yPosition -= 20;
  page.drawText(`Datum otvaranja: ${formatDate(workOrder.created_at)}`, { x: 50, y: yPosition, size: 10, font: timesRomanFont });
  yPosition -= 15;
  
  const closedDate = workOrder.closed_at || new Date().toISOString();
  page.drawText(`Datum zatvaranja: ${formatDate(closedDate)}`, { x: 50, y: yPosition, size: 10, font: timesRomanFont });
  yPosition -= 30;
  page.drawText("Klijent:", { x: 50, y: yPosition, size: 12, font: timesRomanBold });
  yPosition -= 20;
  page.drawText(workOrder.clients?.name || "N/A", { x: 50, y: yPosition, size: 11, font: timesRomanFont });

  if (workOrder.clients?.pib) {
    yPosition -= 15;
    page.drawText(`PIB: ${workOrder.clients.pib}`, { x: 50, y: yPosition, size: 10, font: timesRomanFont });
  }

  yPosition -= 40;
  page.drawText("Stavke:", { x: 50, y: yPosition, size: 12, font: timesRomanBold });
  yPosition -= 25;
  
  const colWidths = [250, 150, 100];
  let xPos = 50;
  ["Naziv fajla", "Format ploče", "Količina"].forEach((header, i) => {
    page.drawText(header, { x: xPos, y: yPosition, size: 10, font: timesRomanBold });
    xPos += colWidths[i];
  });

  yPosition -= 20;
  fileEntries.forEach((entry: any) => {
    if (yPosition < 100) return;
    xPos = 50;
    [entry.filename || "N/A", entry.plate_formats?.format_name || "N/A", String(entry.quantity || 0)].forEach((text, i) => {
      page.drawText(text.substring(0, 30), { x: xPos, y: yPosition, size: 9, font: timesRomanFont });
      xPos += colWidths[i];
    });
    yPosition -= 18;
  });

  return pdfDoc.save();
}

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

    const deliveryNumber = `DN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const pdfBuffer = await generateDeliveryNotePDF(workOrder, fileEntries || [], deliveryNumber);

    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Otpremnica-${workOrder.display_order_number || workOrder.order_number}.pdf"`,
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
