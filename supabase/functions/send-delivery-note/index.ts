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
  // Config
  const CONFIG = {
    pageSize: [595, 420] as [number, number], // A5 landscape
    margin: 24,
    logo: { width: 180, gap: 16 },
    table: {
      cols: { rbr: 40, filename: 250, details: 160, quantity: 60 },
      rowHeight: 22,
      headerBg: rgb(0.95, 0.95, 0.95),
    },
    signature: { lineWidth: 180, yOffset: 60 },
  };

  function isSupportedFontInner(bytes: ArrayBuffer) {
    const sig = String.fromCharCode(...new Uint8Array(bytes).slice(0, 4));
    return sig === '\x00\x01\x00\x00' || sig === 'OTTO';
  }

  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Load fonts
    const regularFontUrl = Deno.env.get('FONT_REGULAR_URL');
    const boldFontUrl = Deno.env.get('FONT_BOLD_URL');
    if (!regularFontUrl || !boldFontUrl) {
      throw new Error('Font URLs not configured');
    }
    const [regularResp, boldResp] = await Promise.all([
      fetch(regularFontUrl),
      fetch(boldFontUrl),
    ]);
    const regularBytes = await regularResp.arrayBuffer();
    const boldBytes = await boldResp.arrayBuffer();
    if (!isSupportedFontInner(regularBytes) || !isSupportedFontInner(boldBytes)) {
      throw new Error('Invalid font format');
    }
    const notoFont = await pdfDoc.embedFont(regularBytes, { subset: true });
    const notoBold = await pdfDoc.embedFont(boldBytes, { subset: true });

    // Load logo
    let logoImg: any = null;
    let logoHeight = 0;
    const logoUrl = Deno.env.get('LOGO_URL');
    if (logoUrl) {
      try {
        const logoResp = await fetch(logoUrl, { cache: 'no-store' });
        if (logoResp.ok) {
          const logoBytes = await logoResp.arrayBuffer();
          logoImg = await pdfDoc.embedPng(logoBytes);
          const aspectRatio = logoImg.height / logoImg.width;
          logoHeight = CONFIG.logo.width * aspectRatio;
        }
      } catch (err) {
        console.warn('Failed to load logo:', err);
      }
    }

    const companyX = CONFIG.margin + CONFIG.logo.width + CONFIG.logo.gap;
    const tableStartY = CONFIG.pageSize[1] - CONFIG.margin - 160;
    const signatureY = CONFIG.signature.yOffset;

    // Helper: draw header on page
    const drawHeader = (page: any) => {
      const { height } = page.getSize();
      let y = height - CONFIG.margin;

      // Logo
      if (logoImg) {
        page.drawImage(logoImg, {
          x: CONFIG.margin,
          y: height - CONFIG.margin - logoHeight,
          width: CONFIG.logo.width,
          height: logoHeight,
        });
      }

      // Company info
      page.drawText('GAMA UNITED d.o.o.', { x: companyX, y, size: 11, font: notoBold });
      y -= 14;
      page.drawText('Šumadijska 29, 11000 Beograd', { x: companyX, y, size: 10, font: notoFont });
      y -= 14;
      page.drawText('PIB: 112345678 | MB: 21234567', { x: companyX, y, size: 10, font: notoFont });
    };

    // Helper: draw meta section
    const drawMeta = (page: any, startY: number): number => {
      let y = startY;
      page.drawText('OTPREMNICA', { x: CONFIG.margin, y, size: 18, font: notoBold });
      y -= 24;
      page.drawText(`Broj: ${deliveryNumber}`, { x: CONFIG.margin, y, size: 11, font: notoFont });
      y -= 16;
      page.drawText(
        `Datum otvaranja: ${formatDate(workOrder.created_at)}`,
        { x: CONFIG.margin, y, size: 10, font: notoFont }
      );
      y -= 14;
      page.drawText(
        `Datum zatvaranja: ${formatDate(workOrder.closed_at || new Date().toISOString())}`,
        { x: CONFIG.margin, y, size: 10, font: notoFont }
      );
      y -= 16;
      page.drawText('Klijent:', { x: CONFIG.margin, y, size: 11, font: notoBold });
      y -= 14;
      page.drawText(workOrder.clients?.name || 'N/A', { x: CONFIG.margin, y, size: 10, font: notoFont });
      if (workOrder.clients?.pib) {
        y -= 14;
        page.drawText(`PIB: ${workOrder.clients.pib}`, { x: CONFIG.margin, y, size: 10, font: notoFont });
      }
      y -= 20;
      return y;
    };

    // Helper: draw table header
    const drawTableHeader = (page: any, y: number): number => {
      const { rbr, filename, details, quantity } = CONFIG.table.cols;
      // Gray background
      page.drawRectangle({
        x: CONFIG.margin,
        y: y - CONFIG.table.rowHeight,
        width: rbr + filename + details + quantity,
        height: CONFIG.table.rowHeight,
        color: CONFIG.table.headerBg,
      });
      let x = CONFIG.margin + 4;
      const headers = ['R.br', 'Naziv fajla', 'Detalji', 'Količina'];
      const widths = [rbr, filename, details, quantity];
      headers.forEach((h, i) => {
        page.drawText(h, { x, y: y - 14, size: 10, font: notoBold });
        x += widths[i];
      });
      return y - CONFIG.table.rowHeight - 4;
    };

    // Helper: draw table row
    const drawTableRow = (page: any, y: number, rbr: number, entry: any): number => {
      const { rbr: rbrW, filename: fnW, details: detW, quantity: qtyW } = CONFIG.table.cols;
      let x = CONFIG.margin + 4;
      const texts = [
        String(rbr),
        (entry.filename || 'N/A').substring(0, 35),
        (entry.plate_formats?.format_name || 'N/A').substring(0, 25),
        String(entry.quantity || 0),
      ];
      const widths = [rbrW, fnW, detW, qtyW];
      texts.forEach((t, i) => {
        page.drawText(t, { x, y: y - 14, size: 9, font: notoFont });
        x += widths[i];
      });
      return y - CONFIG.table.rowHeight;
    };

    // Helper: draw signature block
    const drawSignature = (page: any) => {
      const y = signatureY;
      // Signature line
      page.drawLine({
        start: { x: CONFIG.margin, y },
        end: { x: CONFIG.margin + CONFIG.signature.lineWidth, y },
        thickness: 0.5,
      });
      page.drawText('Robu preuzeo', { x: CONFIG.margin, y: y - 12, size: 9, font: notoFont });

      // ID line
      const idX = CONFIG.margin + CONFIG.signature.lineWidth + 20;
      page.drawLine({
        start: { x: idX, y },
        end: { x: idX + 100, y },
        thickness: 0.5,
      });
      page.drawText('Broj lične karte', { x: idX, y: y - 12, size: 9, font: notoFont });

      // Date line
      const dateX = idX + 120;
      page.drawLine({
        start: { x: dateX, y },
        end: { x: dateX + 80, y },
        thickness: 0.5,
      });
      page.drawText('Datum', { x: dateX, y: y - 12, size: 9, font: notoFont });
    };

    // Helper: draw pagination
    const drawPagination = (page: any, pageNum: number, totalPages: number) => {
      const text = `Strana ${pageNum}/${totalPages}`;
      const width = notoFont.widthOfTextAtSize(text, 9);
      page.drawText(text, {
        x: CONFIG.pageSize[0] - CONFIG.margin - width,
        y: 16,
        size: 9,
        font: notoFont,
      });
    };

    // Build pages
    let currentPage = pdfDoc.addPage(CONFIG.pageSize);
    drawHeader(currentPage);
    let y = drawMeta(currentPage, tableStartY);
    y -= 8;
    currentPage.drawText('Stavke:', { x: CONFIG.margin, y, size: 11, font: notoBold });
    y -= 20;
    y = drawTableHeader(currentPage, y);

    let pageNum = 1;
    const pages = [currentPage];

    fileEntries.forEach((entry, idx) => {
      const needsNewPage = y < signatureY + 40;
      if (needsNewPage) {
        currentPage = pdfDoc.addPage(CONFIG.pageSize);
        pages.push(currentPage);
        pageNum++;
        drawHeader(currentPage);
        y = CONFIG.pageSize[1] - CONFIG.margin - 80;
        y = drawTableHeader(currentPage, y);
      }
      y = drawTableRow(currentPage, y, idx + 1, entry);
    });

    // Draw signature and pagination on all pages
    pages.forEach((p, i) => {
      drawSignature(p);
      if (pages.length > 1) {
        drawPagination(p, i + 1, pages.length);
      }
    });

    return pdfDoc.save();
  } catch (err: any) {
    console.error('PDF generation error:', err?.message, err?.stack);
    throw new Error(`PDF error: ${err?.message}`);
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
