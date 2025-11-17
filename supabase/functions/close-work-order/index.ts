import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { ensureDir } from "https://deno.land/std@0.190.0/fs/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CloseWorkOrderRequest {
  work_order_id: string;
  note?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}.`;
}

// Map order type to short code
function shortType(type?: string): string {
  const map: Record<string, string> = {
    CTP: 'ctp',
    Digital: 'dig',
    film: 'fil',
    Ostalo: 'raz',
  };
  return map[type || ''] ?? 'raz';
}

// Safe filename - remove special characters
function safeFileName(s: string): string {
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')       // remove diacritics
    .replace(/[^A-Za-z0-9._ -]+/g, '')     // remove problematic symbols
    .trim()
    .replace(/\s+/g, '_');
}

// Generate Work Order PDF (Radni Nalog)
async function generateWorkOrderPDF(
  workOrder: any,
  client: any,
  fileEntries: any[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  
  // Fetch Inter font from Google Fonts with Latin Extended subset (includes č, ć, š, đ, ž)
  const fontUrl = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2';
  const fontResponse = await fetch(fontUrl);
  const fontBytes = await fontResponse.arrayBuffer();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(fontBytes, { subset: true });

  let yPos = 800;
  const margin = 50;

  // Header
  page.drawText("RADNI NALOG", {
    x: margin,
    y: yPos,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPos -= 30;

  // Order info
  page.drawText(`Broj naloga: ${workOrder.display_order_number || workOrder.order_number}`, {
    x: margin,
    y: yPos,
    size: 12,
    font: font,
  });
  yPos -= 20;

  page.drawText(`Datum otvaranja: ${formatDate(workOrder.created_at)}`, {
    x: margin,
    y: yPos,
    size: 12,
    font: font,
  });
  yPos -= 20;

  page.drawText(`Datum zatvaranja: ${formatDate(workOrder.closed_at || new Date().toISOString())}`, {
    x: margin,
    y: yPos,
    size: 12,
    font: font,
  });
  yPos -= 30;

  // Client info
  page.drawText(`Klijent: ${client.name}`, {
    x: margin,
    y: yPos,
    size: 12,
    font: boldFont,
  });
  yPos -= 20;

  if (client.pib) {
    page.drawText(`PIB: ${client.pib}`, {
      x: margin,
      y: yPos,
      size: 10,
      font: font,
    });
    yPos -= 15;
  }

  yPos -= 20;

  // File entries
  page.drawText("Stavke:", {
    x: margin,
    y: yPos,
    size: 12,
    font: boldFont,
  });
  yPos -= 25;

  for (const entry of fileEntries) {
    if (yPos < 100) {
      break;
    }

    page.drawText(
      `${entry.filename} - ${entry.plate_formats?.format_name || "N/A"} x ${entry.quantity || 0}`,
      {
        x: margin + 10,
        y: yPos,
        size: 10,
        font: font,
      }
    );
    yPos -= 18;
  }

  return await pdfDoc.save();
}

// Generate Delivery Note PDF (Otpremnica)
async function generateDeliveryNotePDF(
  workOrder: any,
  fileEntries: any[],
  deliveryNumber: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Fetch Inter font from Google Fonts with Latin Extended subset (includes č, ć, š, đ, ž)
  const fontUrl = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2';
  const fontResponse = await fetch(fontUrl);
  const fontBytes = await fontResponse.arrayBuffer();
  const timesRomanFont = await pdfDoc.embedFont(fontBytes, { subset: true });
  const timesRomanBold = await pdfDoc.embedFont(fontBytes, { subset: true });
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
  page.drawText(`Datum zatvaranja: ${formatDate(workOrder.closed_at || new Date().toISOString())}`, { x: 50, y: yPosition, size: 10, font: timesRomanFont });
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

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

async function logEmail(
  supabase: any,
  workOrderId: string,
  recipientEmail: string,
  subject: string,
  type: 'archive' | 'client',
  status: string,
  errorMessage: string | null = null
) {
  await supabase.from("email_log").insert({
    work_order_id: workOrderId,
    recipient_email: recipientEmail,
    subject: subject,
    type: type,
    status: status,
    error_message: errorMessage,
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let work_order_id: string | undefined;

  try {
    // Validate environment variables FIRST
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const archiveEmail = Deno.env.get('ARCHIVE_EMAIL');
    let fromEmail = Deno.env.get('FROM_EMAIL');
    
    if (!resendApiKey) {
      console.error('[closeWorkOrder] Missing RESEND_API_KEY');
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing RESEND_API_KEY environment variable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    if (!archiveEmail) {
      console.error('[closeWorkOrder] Missing ARCHIVE_EMAIL');
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing ARCHIVE_EMAIL environment variable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Use fallback if FROM_EMAIL is not configured (domain not verified in Resend)
    if (!fromEmail) {
      fromEmail = 'noreply@resend.dev';
      console.warn('[closeWorkOrder] FROM_EMAIL not set, using fallback: noreply@resend.dev (verify your domain in Resend to use custom sender)');
    } else {
      console.log('[closeWorkOrder] Using FROM_EMAIL:', fromEmail);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const resend = new Resend(resendApiKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Nedostaje autorizacija');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Niste autentifikovani');

    const requestBody: CloseWorkOrderRequest = await req.json();
    work_order_id = requestBody.work_order_id;
    const note = requestBody.note;
    
    if (!work_order_id) throw new Error('work_order_id je obavezan');

    console.log('Closing work order:', work_order_id);

    const { data: workOrder, error: fetchError } = await supabase
      .from('work_orders')
      .select('*, clients(name, email, notification_email, pib)')
      .eq('id', work_order_id)
      .single();

    if (fetchError || !workOrder) throw new Error('Radni nalog nije pronađen');
    if (workOrder.status === 'closed') throw new Error('Nalog je već zatvoren');

    const functionName = workOrder.order_type === 'film' ? 'close_film_work_order' : 'close_work_order_atomic';
    const { data: closeResult, error: closeError } = await supabase.rpc(functionName, {
      p_work_order_id: work_order_id,
      p_user_id: user.id
    });

    if (closeError) throw new Error(closeError.message);
    const result = closeResult as { success: boolean; error?: string };
    if (!result?.success) throw new Error(result?.error || 'Greška pri zatvaranju naloga');

    if (note?.trim()) {
      await supabase.from('work_order_events').insert({
        work_order_id,
        event_type: 'note',
        created_by: user.id,
        metadata: { note: note.trim(), context: 'closing' }
      });
    }

    const { data: fileEntries } = await supabase
      .from('file_entries')
      .select('*, plate_formats(format_name)')
      .eq('work_order_id', work_order_id);

    // Prepare temp directory for PDFs
    const tmpDir = "/tmp";
    await ensureDir(tmpDir);
    
    const deliveryNumber = `DN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const orderNo = workOrder.display_order_number || workOrder.order_number;
    const clientName = workOrder.clients?.name || "N/A";
    const orderType = workOrder.order_type.toUpperCase();
    
    // Generate structured PDF filenames
    const dateISO = new Date(workOrder.created_at).toISOString().slice(0, 10);
    const typeCode = shortType(workOrder.order_type);
    const clientSafe = safeFileName(clientName);
    const orderCode = workOrder.order_code || orderNo;

    // Use consistent filenames for idempotency
    const deliveryNotePath = `${tmpDir}/${orderCode}_${dateISO}_${typeCode}_${clientSafe}_Otpremnica.pdf`;
    const workOrderPath = `${tmpDir}/${orderCode}_${dateISO}_${typeCode}_${clientSafe}_RN.pdf`;

    // Check if PDFs already exist (idempotency within request)
    let deliveryNotePdfBytes: Uint8Array;
    let workOrderPdfBytes: Uint8Array;

    try {
      await Deno.stat(deliveryNotePath);
      console.log(`Delivery note PDF already exists, reusing: ${deliveryNotePath}`);
      deliveryNotePdfBytes = await Deno.readFile(deliveryNotePath);
    } catch {
      console.log("Generating delivery note PDF...");
      deliveryNotePdfBytes = await generateDeliveryNotePDF(workOrder, fileEntries || [], deliveryNumber);
      await Deno.writeFile(deliveryNotePath, deliveryNotePdfBytes);
    }

    try {
      await Deno.stat(workOrderPath);
      console.log(`Work order PDF already exists, reusing: ${workOrderPath}`);
      workOrderPdfBytes = await Deno.readFile(workOrderPath);
    } catch {
      console.log("Generating work order PDF...");
      workOrderPdfBytes = await generateWorkOrderPDF(workOrder, workOrder.clients, fileEntries || []);
      await Deno.writeFile(workOrderPath, workOrderPdfBytes);
    }

    // Convert to base64 for email attachments
    const deliveryNoteBase64 = btoa(String.fromCharCode(...deliveryNotePdfBytes));
    const workOrderBase64 = btoa(String.fromCharCode(...workOrderPdfBytes));

    // Calculate total attachment size in bytes
    const totalSizeBytes = deliveryNotePdfBytes.length + workOrderPdfBytes.length;
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    const MAX_SIZE_MB = 8;

    console.log(`Total attachment size: ${totalSizeMB.toFixed(2)} MB`);

    // Get user who closed the order
    const { data: closedByUser } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    const closedByName = closedByUser?.full_name || 'N/A';
    const closedAtFormatted = formatDate(workOrder.closed_at || new Date().toISOString());

    let archiveAttachments: Array<{ filename: string; content: string }> = [];
    let archiveEmailBody = `
      <p>Arhiva – zatvoreni nalog ${orderNo} (${orderType})</p>
      <p>Klijent: ${clientName}</p>
      <p>Zatvorio: ${closedByName} u ${closedAtFormatted}</p>
    `;
    
    // If attachments exceed 8 MB, upload to Storage and send links
    if (totalSizeMB > MAX_SIZE_MB) {
      console.log("Attachments exceed 8 MB, uploading to Storage...");
      
      const timestamp = Date.now();
      const workOrderStoragePath = `email-archive/${work_order_id}/${orderCode}_${dateISO}_${typeCode}_${clientSafe}_RN_${timestamp}.pdf`;
      const deliveryNoteStoragePath = `email-archive/${work_order_id}/${orderCode}_${dateISO}_${typeCode}_${clientSafe}_Otpremnica_${timestamp}.pdf`;

      // Upload PDFs to Supabase Storage
      const { error: uploadError1 } = await supabase.storage
        .from('email-archive')
        .upload(workOrderStoragePath, workOrderPdfBytes, {
          contentType: 'application/pdf',
          upsert: false
        });

      const { error: uploadError2 } = await supabase.storage
        .from('email-archive')
        .upload(deliveryNoteStoragePath, deliveryNotePdfBytes, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError1 || uploadError2) {
        console.error("Storage upload error:", uploadError1 || uploadError2);
        throw new Error("Failed to upload PDFs to storage");
      }

      // Generate signed URLs (60 minutes)
      const { data: workOrderUrl } = await supabase.storage
        .from('email-archive')
        .createSignedUrl(workOrderStoragePath, 3600);

      const { data: deliveryNoteUrl } = await supabase.storage
        .from('email-archive')
        .createSignedUrl(deliveryNoteStoragePath, 3600);

      // Create email with download links
      archiveEmailBody = `
        <p>Arhiva – zatvoreni nalog ${orderNo} (${orderType})</p>
        <p>Klijent: ${clientName}</p>
        <p>Zatvorio: ${closedByName} u ${closedAtFormatted}</p>
        <br>
        <p>Prilozi su preveliki za email (${totalSizeMB.toFixed(2)} MB). Preuzmite fajlove putem linkova ispod:</p>
        <ul>
          <li><a href="${workOrderUrl?.signedUrl}">Radni Nalog - ${orderNo}</a> (važi 60 minuta)</li>
          <li><a href="${deliveryNoteUrl?.signedUrl}">Otpremnica - ${orderNo}</a> (važi 60 minuta)</li>
        </ul>
      `;
    } else {
      // Use attachments as normal
      archiveAttachments = [
        {
          filename: `${orderCode}_${dateISO}_${typeCode}_${clientSafe}_RN.pdf`,
          content: workOrderBase64,
        },
        {
          filename: `${orderCode}_${dateISO}_${typeCode}_${clientSafe}_Otpremnica.pdf`,
          content: deliveryNoteBase64,
        },
      ];
    }

    // Send email to archive with retry logic
    console.log(`Sending archive email to ${archiveEmail}...`);
    const archiveSubject = `[RNGU] ${orderNo} – ${clientName} – ${orderType} CLOSED`;
    try {
      await retryWithBackoff(async () => {
        return await resend.emails.send({
          from: fromEmail,
          to: archiveEmail,
          subject: archiveSubject,
          html: archiveEmailBody,
          attachments: archiveAttachments.length > 0 ? archiveAttachments : undefined,
        });
      });
      await logEmail(supabase, work_order_id, archiveEmail, archiveSubject, 'archive', 'sent', null);
      console.log("Archive email sent successfully");
    } catch (error: any) {
      console.error("Failed to send archive email after retries:", error);
      await logEmail(supabase, work_order_id, archiveEmail, archiveSubject, 'archive', 'error', error?.message || String(error));
    }

    // Send email to client (only delivery note) with retry logic
    const clientEmail = workOrder.clients?.notification_email || workOrder.clients?.email;
    let clientEmailStatus = 'skipped';
    let clientEmailMessage = '';
    
    if (!clientEmail) {
      console.warn(`[closeWorkOrder] Client email missing for order ${work_order_id}, skipping client email`);
      clientEmailStatus = 'skipped';
      clientEmailMessage = 'Klijent nema email adresu, poslat samo arhivski mail';
    } else {
      console.log(`Sending client email to ${clientEmail}...`);
      const clientSubject = `Završen posao – ${clientName} – ${orderNo}`;
      try {
        await retryWithBackoff(async () => {
          return await resend.emails.send({
            from: fromEmail,
            to: clientEmail,
            subject: clientSubject,
            html: `
              <p>Poštovani/na ${clientName},</p>
              <br>
              <p>Obaveštavamo vas da je posao <strong>${orderNo}</strong> (${orderType}) završen.</p>
              <p>U prilogu je otpremnica.</p>
              <p>Ovaj mail je automatski generisan i operateri ne odgovaraju na dodatna pitanja, za kontakt sa operaterima koristite standardan mail: <a href="mailto:ctp@gamaunited.rs">ctp@gamaunited.rs</a></p>
              <br>
              <p>Srdačno,<br><strong>GAMA UNITED</strong></p>
            `,
            attachments: [
              {
                filename: `${orderCode}_${dateISO}_${typeCode}_${clientSafe}_Otpremnica.pdf`,
                content: deliveryNoteBase64,
              },
            ],
          });
        });
        await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'client', 'sent', null);
        console.log("Client email sent successfully");
        clientEmailStatus = 'sent';
      } catch (error: any) {
        console.error("Failed to send client email after retries:", error);
        await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'client', 'error', error?.message || String(error));
        clientEmailStatus = 'error';
        clientEmailMessage = 'Greška pri slanju klijentskog mejla';
      }
    }

    // Cleanup: Delete PDFs from /tmp after all emails sent
    console.log("Cleaning up temporary PDF files...");
    try {
      await Deno.remove(deliveryNotePath);
      await Deno.remove(workOrderPath);
      console.log("Temporary PDFs deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete temporary PDFs:", error);
      // Non-critical error, don't fail the request
    }

    // Record delivery note
    await supabase.from('delivery_notes').insert({
      work_order_id: work_order_id,
      delivery_number: deliveryNumber,
      client_name: workOrder.clients?.name || 'N/A',
      client_pib: workOrder.clients?.pib,
      opened_at: workOrder.created_at,
      closed_at: new Date().toISOString(),
      items: fileEntries || [],
      sent_at: new Date().toISOString(),
      sent_to_email: clientEmail,
    });

    const { data: updatedOrder } = await supabase
      .from('work_orders')
      .select('*, clients(name, email)')
      .eq('id', work_order_id)
      .single();

    const successMessage = clientEmailStatus === 'skipped' 
      ? `Nalog zatvoren. ${clientEmailMessage}. Arhivski mail poslat.`
      : clientEmailStatus === 'error'
      ? `Nalog zatvoren. ${clientEmailMessage}. Arhivski mail poslat.`
      : 'Nalog uspešno zatvoren i emails poslati';

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: successMessage,
        work_order: updatedOrder,
        clientEmailStatus 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[closeWorkOrder]', { orderId: work_order_id, error: error?.message || error });
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Došlo je do greške' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
};

serve(handler);
