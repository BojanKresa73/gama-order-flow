import { Buffer } from "node:buffer";
// @ts-ignore
(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendDeliveryNoteEmail, retryWithBackoff } from '../_shared/email-helpers.ts';
import { generateDeliveryNotePDF } from '../_shared/delivery-note-pdf.ts';

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
          notification_email,
          notification_email_2
        )
      `)
      .eq("id", workOrderId)
      .single();

    if (woError || !workOrder) {
      console.error("Error fetching work order:", woError);
      throw new Error("Work order not found");
    }

    // Determine order type and fetch appropriate items
    const orderType = workOrder.order_type?.toLowerCase();
    let items: any[] = [];

    if (orderType === 'film') {
      // Fetch film jobs for film orders
      const { data: filmJobs, error: filmError } = await supabaseClient
        .from("film_jobs")
        .select("*")
        .eq("work_order_id", workOrderId);

      if (filmError) {
        console.error("Error fetching film jobs:", filmError);
        throw new Error("Error fetching film jobs");
      }

      if (!filmJobs || filmJobs.length === 0) {
        throw new Error("No film jobs found for this work order");
      }

      // Map film jobs to a common format for delivery note
      items = filmJobs.map(job => ({
        id: job.id,
        filename: job.file_name,
        quantity: job.qty,
        file_type: 'film',
        width_mm: job.width_mm,
        height_mm: job.height_mm,
        computed_total_m: job.computed_total_m,
        note: job.note
      }));
      console.log(`Fetched ${items.length} film jobs for work order`);
    } else if (orderType === 'digital') {
      // Fetch digital jobs
      const { data: digitalJobs, error: digitalError } = await supabaseClient
        .from("digital_jobs")
        .select("*")
        .eq("work_order_id", workOrderId);

      if (digitalError) {
        console.error("Error fetching digital jobs:", digitalError);
        throw new Error("Error fetching digital jobs");
      }

      if (!digitalJobs || digitalJobs.length === 0) {
        throw new Error("No digital jobs found for this work order");
      }

      // Check if work order has run_quantity (product quantity) set
      const hasRunQuantity = workOrder.run_quantity && workOrder.run_quantity > 0 && workOrder.job_name;

      items = digitalJobs.map(job => ({
        id: job.id,
        filename: job.file_name || job.name,
        quantity: hasRunQuantity 
          ? workOrder.run_quantity 
          : `${job.obim * job.qty} tab. ${job.print_sides}`,
        file_type: 'digital',
        machine_sheet_format: job.machine_sheet_format,
        print_sides: job.print_sides,
        obim: job.obim,
        qty: job.qty,
        computed_total_sheets: job.computed_total_sheets
      }));
      console.log(`Fetched ${items.length} digital jobs for work order`);
    } else {
      // Default: Fetch file entries for CTP/other orders
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

      items = fileEntries.map(fe => ({
        ...fe,
        filename: fe.filename,
        quantity: fe.quantity
      }));
      console.log(`Fetched ${items.length} file entries for work order`);
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
        items: items.map((item: any) => ({
          filename: item.filename,
          quantity: item.quantity,
          file_type: item.file_type,
          computed_total_m: item.computed_total_m,
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
      items
    );

    // Upload PDF to storage
    const orderLabel = displayOrderNumber({
      order_code: workOrder.order_code,
      created_at: workOrder.created_at,
      client_name: workOrder.client?.name || 'klijent',
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

    // Collect notification emails
    const notificationEmails: string[] = [];
    if (workOrder.client.notification_email) {
      notificationEmails.push(workOrder.client.notification_email);
    }
    if (workOrder.client.notification_email_2) {
      notificationEmails.push(workOrder.client.notification_email_2);
    }

    // Send email if notification email(s) exist
    if (notificationEmails.length > 0) {
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
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 4px;
                color: #1e40af;
              }
              
              .company-info p {
                font-size: 10px;
                line-height: 1.4;
                color: #374151;
              }
              
              .delivery-info {
                text-align: right;
                flex: 1;
              }
              
              .delivery-info h2 {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 8px;
                color: #1e40af;
                letter-spacing: 1px;
              }
              
              .delivery-info p {
                font-size: 11px;
                margin-bottom: 3px;
                color: #374151;
              }
              
              /* Client box */
              .client-box {
                border: 2px solid #1e40af;
                border-radius: 6px;
                padding: 10px 12px;
                margin-bottom: 14px;
                background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
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
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                color: white;
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
                  <p>Veljka Milićevića 2/10, 11000 Beograd</p>
                  <p>PIB: 114876455</p>
                </div>
                <div class="delivery-info">
                  <h2>OTPREMNICA</h2>
                  <p><strong>Br. naloga:</strong> ${workOrder.order_number}</p>
                  <p><strong>Datum:</strong> ${formatDate(deliveryNote.closed_at)}</p>
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
                items && items.length > 0
                  ? `
              <!-- Items table -->
              <table>
                <thead>
                  <tr>
                    <th class="number">#</th>
                    <th>Naziv fajla</th>
                    <th class="format">${orderType === 'film' ? 'Potrošeno' : orderType === 'digital' ? 'Format' : 'Format ploče'}</th>
                    <th class="quantity">Količina</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map(
                      (item: any, index: number) => `
                    <tr>
                      <td class="number">${index + 1}</td>
                      <td>${item.filename}</td>
                      <td class="format">${orderType === 'film' 
                        ? (item.computed_total_m ? item.computed_total_m.toFixed(2) + ' m' : '-') 
                        : orderType === 'digital'
                        ? (item.machine_sheet_format || '-')
                        : (item.plate_format?.format_name || "-")}</td>
                      <td class="quantity">${item.quantity || "-"}</td>
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
      console.log('[send-delivery-note] Sending email to:', notificationEmails);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      await retryWithBackoff(async () => {
        await sendDeliveryNoteEmail({
          subject: `Završen posao – ${workOrder.client.name} – ${deliveryNumber}`,
          to: notificationEmails,
          pdfBucket: 'delivery-notes',
          pdfPath: pdfPath, // Use the local variable, not deliveryNote.pdf_path which is still null
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
          sent_to_email: notificationEmails.join(', ')
        })
        .eq("id", deliveryNote.id);

      // Log email for each recipient
      for (const recipientEmail of notificationEmails) {
        await supabaseClient.from("email_log").insert({
          work_order_id: workOrderId,
          recipient_email: recipientEmail,
          subject: `Završen posao – ${workOrder.client.name} – ${deliveryNumber}`,
          status: "sent",
          type: "delivery_note",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deliveryNote,
        emailSent: notificationEmails.length > 0,
        emailRecipients: notificationEmails,
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
