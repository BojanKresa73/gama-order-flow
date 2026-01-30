import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const { client_name, date_from, date_to, recipient_email } = await req.json();

    if (!client_name || !date_from || !date_to || !recipient_email) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: client_name, date_from, date_to, recipient_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating and sending report for ${client_name} from ${date_from} to ${date_to} to ${recipient_email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch delivery notes
    const { data: deliveryNotes, error } = await supabase
      .from("delivery_notes")
      .select("*")
      .ilike("client_name", `%${client_name}%`)
      .gte("sent_at", date_from)
      .lte("sent_at", date_to + "T23:59:59")
      .order("sent_at", { ascending: true });

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
    const pdfBytes = await generatePDF(deliveryNotes as DeliveryNote[], client_name, date_from, date_to);
    
    // Convert to base64 for email attachment
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    // Send email with Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@gamaunited.rs";
    
    // Calculate totals for email body
    let totalItems = 0;
    let totalQuantity = 0;
    deliveryNotes.forEach(dn => {
      const items = (dn as DeliveryNote).items as any[];
      totalItems += items.length;
      items.forEach(item => {
        totalQuantity += item.quantity || 0;
      });
    });

    const formatDateSR = (iso: string) => {
      const d = new Date(iso);
      return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}.`;
    };

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [recipient_email],
      subject: `Izveštaj o otpremnicama - ${deliveryNotes[0]?.client_name || client_name} (${formatDateSR(date_from)} - ${formatDateSR(date_to)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Izveštaj o otpremnicama</h2>
          <p><strong>Klijent:</strong> ${deliveryNotes[0]?.client_name || client_name}</p>
          <p><strong>Period:</strong> ${formatDateSR(date_from)} - ${formatDateSR(date_to)}</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin: 0 0 12px 0; color: #374151;">Rezime:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Ukupno otpremnica:</strong> ${deliveryNotes.length}</li>
              <li><strong>Ukupno stavki:</strong> ${totalItems}</li>
              <li><strong>Ukupna količina:</strong> ${totalQuantity}</li>
            </ul>
          </div>
          
          <p>U prilogu se nalazi detaljan PDF izveštaj sa svim otpremnicama.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="font-size: 12px; color: #6b7280;">
            Ovaj email je automatski generisan iz sistema GAMA United.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Otpremnice-${client_name.replace(/[^a-zA-Z0-9]/g, '_')}-${date_from}-${date_to}.pdf`,
          content: pdfBase64,
        }
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Izveštaj poslat na ${recipient_email}`,
        deliveryNotesCount: deliveryNotes.length,
        totalItems,
        totalQuantity
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
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
