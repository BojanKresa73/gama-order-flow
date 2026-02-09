import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeliveryNote {
  id: string;
  delivery_number: string;
  client_name: string;
  work_order_number: string | null;
  opened_at: string;
  closed_at: string;
  sent_at: string | null;
  items: Array<{
    filename: string;
    quantity: number;
    file_type: string;
  }>;
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

    // Fetch delivery notes — use range to bypass default 1000-row limit
    const { data: deliveryNotes, error } = await supabase
      .from("delivery_notes")
      .select("*")
      .ilike("client_name", `%${clientName}%`)
      .gte("closed_at", dateFrom)
      .lte("closed_at", dateTo + "T23:59:59")
      .order("closed_at", { ascending: true })
      .range(0, 9999);

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log(`Found ${deliveryNotes?.length || 0} delivery notes`);

    if (!deliveryNotes || deliveryNotes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nema otpremnica za dati period" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate PDF
    const pdfBytes = await generatePDF(deliveryNotes as DeliveryNote[], clientName, dateFrom, dateTo);

    return new Response(pdfBytes as unknown as ArrayBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Otpremnice-${clientName.replace(/[^a-zA-Z0-9]/g, '_')}-${dateFrom}-${dateTo}.pdf"`,
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
  deliveryNotes: DeliveryNote[],
  clientName: string,
  dateFrom: string,
  dateTo: string
): Promise<Uint8Array> {
  // Calculate totals
  let totalItems = 0;
  let totalQuantity = 0;
  deliveryNotes.forEach(dn => {
    const items = dn.items as any[];
    totalItems += items.length;
    items.forEach(item => {
      totalQuantity += item.quantity || 0;
    });
  });

  // Format dates
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}.`;
  };

  // Use pdf-lib for proper PDF generation
  const { PDFDocument, rgb, StandardFonts } = await import("https://esm.sh/pdf-lib@1.17.1");
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 595.28; // A4
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
    // Sanitize text - remove non-ASCII characters for standard fonts
    const sanitizedText = text.replace(/[^\x00-\x7F]/g, (char) => {
      const replacements: Record<string, string> = {
        'č': 'c', 'ć': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj',
        'Č': 'C', 'Ć': 'C', 'Š': 'S', 'Ž': 'Z', 'Đ': 'Dj',
      };
      return replacements[char] || char;
    });
    
    page.drawText(sanitizedText.substring(0, 100), {
      x: margin + indent,
      y,
      size,
      font: f,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight * (size / 10);
  };
  
  const addLine = () => {
    if (y < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 10;
  };

  // Header
  addText("IZVESTAJ O OTPREMNICAMA", 16, true);
  y -= 10;
  addText(`Klijent: ${deliveryNotes[0]?.client_name || clientName}`, 12, true);
  addText(`Period: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, 11);
  addText(`Generisano: ${formatDate(new Date().toISOString())}`, 10);
  y -= 10;
  addLine();
  y -= 5;
  
  // Summary
  addText(`UKUPNO OTPREMNICA: ${deliveryNotes.length}`, 12, true);
  addText(`UKUPNO STAVKI: ${totalItems}`, 11);
  addText(`UKUPNA KOLICINA: ${totalQuantity}`, 11);
  y -= 10;
  addLine();
  
  // Each delivery note
  deliveryNotes.forEach((dn, index) => {
    y -= 5;
    addText(`${index + 1}. ${dn.delivery_number}`, 11, true);
    addText(`Radni nalog: ${dn.work_order_number || "-"}`, 10, false, 15);
    addText(`Zatvoreno: ${formatDate(dn.closed_at)}  |  Poslato: ${dn.sent_at ? formatDate(dn.sent_at) : "-"}`, 9, false, 15);
    
    const items = dn.items as any[];
    items.forEach((item) => {
      const filename = item.filename.length > 60 ? item.filename.substring(0, 57) + "..." : item.filename;
      addText(`- ${filename} - Kol: ${item.quantity || 0}`, 9, false, 25);
    });
    
    y -= 5;
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
