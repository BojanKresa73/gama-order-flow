import { Buffer } from "node:buffer";
// @ts-ignore
(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendDeliveryNoteEmail, retryWithBackoff } from '../_shared/smtp-helpers.ts';
import { generateDeliveryNotePDF } from '../_shared/delivery-note-pdf.ts';
import { generateDeliveryNoteEmailHtml } from '../_shared/email-template.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeliveryNoteRequest {
  workOrderId: string;
  resend?: boolean;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Server nije podešen (SUPABASE_URL / SERVICE_ROLE_KEY)");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nedostaje autorizacija");

    const token = authHeader.replace("Bearer ", "");

    // Use service role for DB ops (bypasses RLS) + verify user token explicitly
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Niste autentifikovani");

    const { workOrderId, resend }: DeliveryNoteRequest = await req.json();

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
          notification_email_2,
          notification_email_3
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

      // Check if work order has job_name (product mode vs sheet mode)
      const hasJobName = workOrder.job_name && workOrder.job_name.trim().length > 0;

      if (hasJobName) {
        // Product mode: show single item with job name and run_quantity
        items = [{
          id: workOrder.id,
          filename: workOrder.job_name,
          quantity: workOrder.run_quantity || 1,
          file_type: 'digital_product',
          machine_sheet_format: null,
          print_sides: null,
          obim: null,
          qty: null,
          computed_total_sheets: null
        }];
      } else {
        // Sheet mode: show individual files with format and print type
        items = digitalJobs.map(job => ({
          id: job.id,
          filename: job.file_name || job.name,
          quantity: `${job.obim * job.qty} tab. ${job.print_sides}`,
          file_type: 'digital_sheet',
          machine_sheet_format: job.machine_sheet_format,
          print_sides: job.print_sides,
          obim: job.obim,
          qty: job.qty,
          computed_total_sheets: job.computed_total_sheets
        }));
      }
      console.log(`Fetched ${items.length} digital items for work order (mode: ${hasJobName ? 'product' : 'sheet'})`);
    } else if (orderType === 'ctp') {
      // CTP orders: use file entries with their quantities
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
      console.log(`Fetched ${items.length} file entries for CTP work order`);
    } else {
      // OSTALO/RAZNO orders: use job_name and run_quantity from work order
      // Job name is required for OSTALO orders
      items = [{
        id: workOrder.id,
        filename: workOrder.job_name || 'Usluga',
        quantity: workOrder.run_quantity || 1,
        file_type: 'ostalo'
      }];
      console.log(`OSTALO order - using job_name: "${workOrder.job_name}", quantity: ${workOrder.run_quantity}`);
    }

    // Check if delivery note already exists (idempotency)
    const { data: existingNote, error: existingError } = await supabaseClient
      .from("delivery_notes")
      .select("id, sent_at")
      .eq("work_order_id", workOrderId)
      .single();

    if (existingNote && !resend) {
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

    // If resending, delete the old delivery note so we create a fresh one
    if (existingNote && resend) {
      console.log("Resending delivery note, deleting existing:", existingNote.id);
      await supabaseClient
        .from("delivery_notes")
        .delete()
        .eq("id", existingNote.id);
    }

    // Use work order number as delivery number (order_number is the correct format)
    const deliveryNumber = workOrder.order_number;

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
    if (workOrder.client.notification_email_3) {
      notificationEmails.push(workOrder.client.notification_email_3);
    }

    // Send email if notification email(s) exist
    if (notificationEmails.length > 0) {
      // Generate beautiful newsletter-style email HTML
      const emailContent = generateDeliveryNoteEmailHtml({
        clientName: workOrder.client.name,
        orderNumber: deliveryNumber,
        orderDate: formatDate(workOrder.created_at),
        closedDate: formatDate(deliveryNote.closed_at),
        itemCount: items.length,
        orderType: orderType || 'ctp',
        items: items.map((item: any) => ({
          filename: item.filename,
          details: orderType === 'film'
            ? (Number(item.computed_total_m ?? 0) > 0
              ? `${Number(item.computed_total_m).toFixed(2)} m`
              : '-')
            : orderType === 'digital' && item.file_type !== 'digital_product'
            ? (item.machine_sheet_format || '-')
            : (item.plate_format?.format_name || '-'),
          quantity: item.quantity || '-',
        })),
      });

      // Send email using Resend helper
      console.log('[send-delivery-note] Sending email to:', notificationEmails);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      await retryWithBackoff(async () => {
        await sendDeliveryNoteEmail({
          subject: `Završen posao – ${workOrder.client.name} – ${deliveryNumber}`,
          to: notificationEmails,
          pdfBucket: 'delivery-notes',
          pdfPath: pdfPath,
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
