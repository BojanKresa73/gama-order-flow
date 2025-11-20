import { Buffer } from "node:buffer";
// @ts-ignore
(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendDeliveryNoteEmail, retryWithBackoff } from '../_shared/email-helpers.ts';
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeliveryNoteRequest {
  workOrderId: string;
}

// Helper functions for order labeling (matching src/lib/orderLabel.ts)

// Extract sequence number from order code
const extractSeq = (code?: string): string => {
  const m = (code ?? '').match(/(\d+)(?!.*\d)/);
  const n = m ? parseInt(m[1], 10) : 0;
  return String(isNaN(n) ? 0 : n).padStart(4, '0');
};

// Format date as dd.MM.yyyy.
const formatDateSR = (iso?: string | Date): string => {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
};

// Format date for display (old version for compatibility)
const formatDate = (dateString: string): string => {
  return formatDateSR(dateString);
};

// Convert order type to short uppercase code
const toTypeShort = (t?: string): string => {
  const s = (t ?? '').toLowerCase();
  if (s === 'ctp') return 'CTP';
  if (s === 'digital') return 'DIG';
  if (s === 'film' || s === 'fil') return 'FIL';
  return 'RAZ';
};

// Map order type to short code (old version for compatibility)
const shortType = (type?: string): string => {
  return toTypeShort(type).toLowerCase();
};

// Generate display label for order: seq-date-type-client
const displayOrderNumber = (o: {
  order_code?: string;
  created_at?: string;
  client_name?: string;
  type?: string;
}): string => {
  const seq = extractSeq(o.order_code);
  const date = formatDateSR(o.created_at);
  const typ = toTypeShort(o.type);
  const cli = o.client_name ?? 'Klijent';
  return `${seq}-${date}-${typ}-${cli}`;
};

// Convert label to safe PDF filename
const toPdfFileName = (label: string): string => {
  const noDiacritics = label.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const safe = noDiacritics
    .replace(/\./g, '-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${safe}.pdf`;
};

// Safe filename - remove special characters (old version for compatibility)
const safeFileName = (s: string): string =>
  s.normalize('NFKD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[^A-Za-z0-9._ -]+/g, '')
   .trim()
   .replace(/\s+/g, '_');

// Helper function to validate font format
function isSupportedFont(bytes: ArrayBuffer) {
  const sig = String.fromCharCode(...new Uint8Array(bytes).slice(0,4));
  return sig === '\x00\x01\x00\x00' || sig === 'OTTO'; // TTF or OTF
}

// Helper function to generate PDF
const generateDeliveryNotePDF = async (
  workOrder: any,
  fileEntries: any[],
  deliveryNumber: string
): Promise<Uint8Array> => {
  try {
    const pdfDoc = await PDFDocument.create();
    
    // Register fontkit for custom font support
    pdfDoc.registerFontkit(fontkit);
    
    // Fetch fonts from Supabase Storage using secrets
    const regularFontUrl = Deno.env.get('FONT_REGULAR_URL');
    const boldFontUrl = Deno.env.get('FONT_BOLD_URL');
    
    if (!regularFontUrl || !boldFontUrl) {
      throw new Error('Font URLs not configured. Please set FONT_REGULAR_URL and FONT_BOLD_URL secrets.');
    }
    
    const regularFontResponse = await fetch(regularFontUrl);
    const boldFontResponse = await fetch(boldFontUrl);
    
    const regularFontBytes = await regularFontResponse.arrayBuffer();
    const boldFontBytes = await boldFontResponse.arrayBuffer();
    
    if (!isSupportedFont(regularFontBytes)) {
      throw new Error('Regular font is not TTF/OTF – got wrong format (likely WOFF/HTML).');
    }
    if (!isSupportedFont(boldFontBytes)) {
      throw new Error('Bold font is not TTF/OTF – got wrong format (likely WOFF/HTML).');
    }
    
    const font = await pdfDoc.embedFont(regularFontBytes, { subset: true });
    const fontBold = await pdfDoc.embedFont(boldFontBytes, { subset: true });
  
    const page = pdfDoc.addPage([595, 420]); // A5 landscape (595x420 points)
  
  const { width, height } = page.getSize();
  let yPosition = height - 40;

  // Try to render logo (fail-safe)
  let logoHeight = 0;
  const logoUrl = Deno.env.get('LOGO_URL');
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const targetWidth = 180; // ~63mm
        const aspectRatio = logoImage.height / logoImage.width;
        logoHeight = targetWidth * aspectRatio;
        
        page.drawImage(logoImage, {
          x: 40,
          y: height - 40 - logoHeight,
          width: targetWidth,
          height: logoHeight,
        });
      }
    } catch (err) {
      console.warn('Failed to load logo, continuing without it:', err);
    }
  }

  // Header - Company Info (positioned to the right of logo)
  const companyTextX = 240;
  page.drawText("Gama United", {
    x: companyTextX,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 15;
  page.drawText("Adresa vaše firme", { x: companyTextX, y: yPosition, size: 9, font });
  yPosition -= 12;
  page.drawText("Grad, Poštanski broj", { x: companyTextX, y: yPosition, size: 9, font });
  yPosition -= 12;
  page.drawText("PIB: 123456789", { x: companyTextX, y: yPosition, size: 9, font });

  // Header - Delivery Info (right side)
  const rightX = width - 200;
  yPosition = height - 40;
  page.drawText("OTPREMNICA", {
    x: rightX,
    y: yPosition,
    size: 16,
    font: fontBold,
  });
  yPosition -= 20;
  page.drawText(`Broj naloga: ${workOrder.order_number}`, {
    x: rightX,
    y: yPosition,
    size: 10,
    font,
  });
  yPosition -= 15;
  page.drawText(
    `Datum zatvaranja: ${workOrder.closed_at ? formatDate(workOrder.closed_at) : "-"}`,
    { x: rightX, y: yPosition, size: 10, font }
  );

  // Line separator
  yPosition = height - 105;
  page.drawLine({
    start: { x: 40, y: yPosition },
    end: { x: width - 40, y: yPosition },
    thickness: 2,
    color: rgb(0, 0, 0),
  });

  // Client Box
  yPosition -= 20;
  page.drawRectangle({
    x: 40,
    y: yPosition - 35,
    width: width - 80,
    height: 40,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });
  
  page.drawText(`Klijent: ${workOrder.client.name}`, {
    x: 50,
    y: yPosition - 15,
    size: 10,
    font,
  });
  if (workOrder.client.pib) {
    page.drawText(`PIB: ${workOrder.client.pib}`, {
      x: 50,
      y: yPosition - 28,
      size: 10,
      font,
    });
  }

  // Table Header
  yPosition -= 60;
  const tableTop = yPosition;
  const colX = { num: 40, filename: 80, format: 320, quantity: 480 };
  
  // Table header background
  page.drawRectangle({
    x: 40,
    y: yPosition - 18,
    width: width - 80,
    height: 20,
    color: rgb(0.91, 0.91, 0.91),
  });

  page.drawText("#", { x: colX.num, y: yPosition - 12, size: 9, font: fontBold });
  page.drawText("Naziv fajla", { x: colX.filename, y: yPosition - 12, size: 9, font: fontBold });
  page.drawText("Format ploče", { x: colX.format, y: yPosition - 12, size: 9, font: fontBold });
  page.drawText("Količina", { x: colX.quantity, y: yPosition - 12, size: 9, font: fontBold });

  // Table rows
  yPosition -= 25;
  fileEntries.forEach((entry, index) => {
    if (yPosition < 80) return; // Prevent overflow
    
    page.drawText(String(index + 1), { x: colX.num + 5, y: yPosition, size: 9, font });
    page.drawText(
      entry.filename.length > 35 ? entry.filename.substring(0, 35) + "..." : entry.filename,
      { x: colX.filename, y: yPosition, size: 9, font }
    );
    page.drawText(
      entry.plate_format?.format_name || "-",
      { x: colX.format, y: yPosition, size: 9, font }
    );
    page.drawText(
      String(entry.quantity || "-"),
      { x: colX.quantity + 15, y: yPosition, size: 9, font }
    );
    
    yPosition -= 15;
  });

  // Table borders
  const tableHeight = tableTop - yPosition + 15;
  page.drawRectangle({
    x: 40,
    y: yPosition,
    width: width - 80,
    height: tableHeight,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1,
  });

  // Footer
  page.drawLine({
    start: { x: 40, y: 60 },
    end: { x: width - 40, y: 60 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  
  page.drawText("Robu preuzeo: _________________", { x: 40, y: 40, size: 9, font });
  page.drawText("Broj lične karte: _________________", { x: 250, y: 40, size: 9, font });
  page.drawText("Strana 1/1", { x: width - 100, y: 40, size: 9, font });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
} catch (err: any) {
  console.error('PDF generation error:', err?.message, err?.stack);
  throw new Error(`PDF font error: ${err?.message}`);
}
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { workOrderId }: DeliveryNoteRequest = await req.json();

    console.log("Fetching work order:", workOrderId);

    // Fetch work order with client info
    const { data: workOrder, error: woError } = await supabaseClient
      .from("work_orders")
      .select(`
        *,
        client:clients (
          id,
          name,
          pib,
          notification_email
        )
      `)
      .eq("id", workOrderId)
      .single();

    if (woError || !workOrder) {
      console.error("Error fetching work order:", woError);
      throw new Error("Work order not found");
    }

    // Fetch file entries with plate format info
    const { data: fileEntries, error: feError } = await supabaseClient
      .from("file_entries")
      .select(`
        *,
        plate_format:plate_formats (
          format_name
        )
      `)
      .eq("work_order_id", workOrderId)
      .eq("status", "closed");

    if (feError) {
      console.error("Error fetching file entries:", feError);
      throw new Error("Error fetching file entries");
    }

    if (!fileEntries || fileEntries.length === 0) {
      throw new Error("No closed file entries found for this work order");
    }

    // Check if delivery note already exists (idempotency)
    const { data: existingNote, error: existingError } = await supabaseClient
      .from("delivery_notes")
      .select("id, sent_at")
      .eq("work_order_id", workOrderId)
      .single();

    if (existingNote) {
      console.log("Delivery note already exists for work order:", workOrderId);
      return new Response(
        JSON.stringify({ 
          message: "Delivery note already sent",
          delivery_note_id: existingNote.id,
          sent_at: existingNote.sent_at
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use work order number as delivery number
    const deliveryNumber = workOrder.display_order_number || workOrder.order_number;

    // Create delivery note
    const { data: deliveryNote, error: dnError } = await supabaseClient
      .from("delivery_notes")
      .insert({
        work_order_id: workOrderId,
        delivery_number: deliveryNumber,
        work_order_number: deliveryNumber,
        client_name: workOrder.client.name,
        client_pib: workOrder.client.pib,
        opened_at: workOrder.created_at,
        closed_at: workOrder.closed_at || new Date().toISOString(),
        items: fileEntries.map((fe) => ({
          filename: fe.filename,
          quantity: fe.quantity,
          file_type: fe.file_type,
        })),
        sent_to_email: workOrder.client.notification_email,
      })
      .select()
      .single();

    if (dnError || !deliveryNote) {
      console.error("Error creating delivery note:", dnError);
      throw new Error("Error creating delivery note");
    }

    // Generate PDF
    console.log("Generating PDF...");
    const pdfBytes = await generateDeliveryNotePDF(
      workOrder,
      fileEntries,
      deliveryNumber
    );

    // Upload PDF to storage
    const orderLabel = displayOrderNumber({
      order_code: workOrder.order_code,
      created_at: workOrder.created_at,
      client_name: workOrder.clients?.name || 'klijent',
      type: workOrder.order_type
    });
    const pdfFileName = toPdfFileName(orderLabel);
    const pdfPath = `delivery-notes/${pdfFileName}`;
    
    const { error: uploadError } = await supabaseClient.storage
      .from("delivery-notes")
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      throw new Error("Error uploading PDF to storage");
    }

    console.log("PDF uploaded to:", pdfPath);

    // Update delivery note with PDF path
    await supabaseClient
      .from("delivery_notes")
      .update({ pdf_path: pdfPath })
      .eq("id", deliveryNote.id);

    // Send email if notification email exists
    if (workOrder.client.notification_email) {
      const emailContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                size: A5 landscape;
                margin: 10mm;
              }
              
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 11px;
                line-height: 1.4;
                color: #000;
              }
              
              .document {
                width: 100%;
                height: 100%;
              }
              
              /* Header */
              .doc-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 2px solid #000;
              }
              
              .company-info {
                flex: 1;
              }
              
              .company-info h1 {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 4px;
              }
              
              .company-info p {
                font-size: 10px;
                line-height: 1.3;
              }
              
              .delivery-info {
                text-align: right;
                flex: 1;
              }
              
              .delivery-info h2 {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 6px;
              }
              
              .delivery-info p {
                font-size: 11px;
                margin-bottom: 2px;
              }
              
              /* Client box */
              .client-box {
                border: 1px solid #000;
                padding: 8px;
                margin-bottom: 12px;
                background: #f9f9f9;
              }
              
              .client-box p {
                margin-bottom: 3px;
              }
              
              .client-box strong {
                font-weight: 600;
              }
              
              /* Table */
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
              }
              
              th, td {
                border: 1px solid #ddd;
                padding: 6px 8px;
                text-align: left;
              }
              
              th {
                background: #e8e8e8;
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
              }
              
              td {
                font-size: 11px;
              }
              
              td.number {
                text-align: center;
                width: 40px;
              }
              
              td.quantity {
                text-align: center;
                width: 80px;
              }
              
              td.format {
                width: 120px;
              }
              
              thead {
                display: table-header-group;
              }
              
              tfoot {
                display: table-footer-group;
              }
              
              tr {
                page-break-inside: avoid;
              }
              
              /* Footer */
              .doc-footer {
                margin-top: 20px;
                padding-top: 12px;
                border-top: 1px solid #ddd;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              
              .signature-line {
                font-size: 10px;
              }
              
              .signature-line span {
                display: inline-block;
                margin-right: 15px;
              }
              
              .signature-line .underline {
                border-bottom: 1px solid #000;
                display: inline-block;
                width: 150px;
                margin-left: 5px;
              }
              
              .pagination {
                font-size: 10px;
                text-align: right;
              }
              
              .no-items {
                text-align: center;
                padding: 40px;
                font-style: italic;
                color: #666;
              }
              
              @media print {
                body {
                  margin: 0;
                  padding: 0;
                }
                
                .doc-footer {
                  position: fixed;
                  bottom: 0;
                  width: 100%;
                }
              }
            </style>
          </head>
          <body>
            <div class="document">
              <!-- Header -->
              <div class="doc-header">
                <div class="company-info">
                  <h1>Gama United</h1>
                  <p>Adresa vaše firme</p>
                  <p>Grad, Poštanski broj</p>
                  <p>PIB: 123456789</p>
                </div>
                <div class="delivery-info">
                  <h2>OTPREMNICA</h2>
                  <p><strong>Broj naloga:</strong> ${workOrder.order_number}</p>
                  <p><strong>Datum zatvaranja:</strong> ${formatDate(deliveryNote.closed_at)}</p>
                </div>
              </div>
              
              <!-- Client info -->
              <div class="client-box">
                <p><strong>Klijent:</strong> ${workOrder.client.name}</p>
                ${workOrder.client.pib && workOrder.client.pib.trim() ? `<p><strong>PIB:</strong> ${workOrder.client.pib}</p>` : ""}
                ${workOrder.client.notification_email && workOrder.client.notification_email.trim() ? `<p><strong>Email:</strong> ${workOrder.client.notification_email}</p>` : ""}
              </div>
              </div>
              
              ${
                fileEntries && fileEntries.length > 0
                  ? `
              <!-- Items table -->
              <table>
                <thead>
                  <tr>
                    <th class="number">#</th>
                    <th>Naziv fajla</th>
                    <th class="format">Format ploče</th>
                    <th class="quantity">Količina</th>
                  </tr>
                </thead>
                <tbody>
                  ${fileEntries
                    .map(
                      (fe, index) => `
                    <tr>
                      <td class="number">${index + 1}</td>
                      <td>${fe.filename}</td>
                      <td class="format">${fe.plate_format?.format_name || "-"}</td>
                      <td class="quantity">${fe.quantity || "-"}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
              `
                  : `
              <div class="no-items">
                <p>Nema zatvorenih stavki za otpremnicu.</p>
              </div>
              `
              }
              
              <!-- Footer -->
              <div class="doc-footer">
                <div class="signature-line">
                  <span>Robu preuzeo: <span class="underline"></span></span>
                  <span>Broj lične karte: <span class="underline"></span></span>
                </div>
                <div class="pagination">
                  Strana 1/1
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      // Send email using Gmail SMTP helper
      console.log('[send-delivery-note] Sending email to:', workOrder.client.notification_email);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      await retryWithBackoff(async () => {
        await sendDeliveryNoteEmail({
          subject: `Završen posao – ${workOrder.client.name} – ${deliveryNumber}`,
          to: [workOrder.client.notification_email],
          pdfBucket: 'delivery-notes',
          pdfPath: deliveryNote.pdf_path!,
          html: emailContent,
          sbUrl: supabaseUrl,
          serviceKey: serviceKey,
        });
      }, 2, 1000);

      console.log("[send-delivery-note] Email sent successfully");

      // Update delivery note with sent timestamp and email
      await supabaseClient
        .from("delivery_notes")
        .update({ 
          sent_at: new Date().toISOString(),
          sent_to_email: workOrder.client.notification_email
        })
        .eq("id", deliveryNote.id);

      // Log email
      await supabaseClient.from("email_log").insert({
        work_order_id: workOrderId,
        recipient_email: workOrder.client.notification_email,
        subject: `Završen posao – ${workOrder.client.name} – ${deliveryNumber}`,
        status: "sent",
        type: "delivery_note",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        deliveryNote,
        emailSent: !!workOrder.client.notification_email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-delivery-note function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
