import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { ensureDir } from "https://deno.land/std@0.190.0/fs/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Custom error class for structured error handling
class AppError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

// Unified helper to get order items
type UiItem = {
  id: string;
  label: string;
  qty: number;
  unit: string;
  total?: number;
  details?: string;
  note?: string;
  status?: string;
};

async function getOrderItems(sb: any, orderId: string): Promise<UiItem[]> {
  // Get work order type
  const { data: order, error: orderError } = await sb
    .from('work_orders')
    .select('id, order_type')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('[getOrderItems] Error fetching work order:', orderError);
    return [];
  }

  // Fetch items based on order type
  if (order.order_type === 'film') {
    const { data, error } = await sb
      .from('film_jobs')
      .select('id, file_name, width_mm, height_mm, qty, computed_total_m, note')
      .eq('work_order_id', orderId)
      .order('created_at');

    if (error) {
      console.error('[getOrderItems] Error fetching film jobs:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      label: item.file_name || 'Bez naziva',
      qty: item.qty,
      unit: 'm',
      total: item.computed_total_m || 0,
      details: `${item.width_mm}×${item.height_mm} mm`,
      note: item.note || undefined,
    }));
  }

  if (order.order_type === 'digital') {
    const { data, error } = await sb
      .from('digital_jobs')
      .select('id, file_name, finished_w_mm, finished_h_mm, qty, pages, computed_total_sheets')
      .eq('work_order_id', orderId)
      .order('order_index');

    if (error) {
      console.error('[getOrderItems] Error fetching digital jobs:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      label: item.file_name || 'Bez naziva',
      qty: item.qty,
      unit: 'tab',
      total: item.computed_total_sheets || 0,
      details: `${item.finished_w_mm}×${item.finished_h_mm} mm, ${item.pages} str`,
    }));
  }

  if (order.order_type === 'ctp') {
    const { data, error } = await sb
      .from('file_entries')
      .select('id, filename, quantity, status, plate_formats(format_name)')
      .eq('work_order_id', orderId)
      .order('created_at');

    if (error) {
      console.error('[getOrderItems] Error fetching file entries:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      label: item.filename || 'Bez naziva',
      qty: item.quantity || 0,
      unit: 'kom',
      details: item.plate_formats?.format_name || 'N/A',
      status: item.status,
    }));
  }

  return [];
}

interface CloseWorkOrderRequest {
  work_order_id: string;
  note?: string;
}

// Helper functions for order labeling (matching src/lib/orderLabel.ts)

// Extract sequence number from order code
function extractSeq(code?: string): string {
  const m = (code ?? '').match(/(\d+)(?!.*\d)/);
  const n = m ? parseInt(m[1], 10) : 0;
  return String(isNaN(n) ? 0 : n).padStart(4, '0');
}

// Format date as dd.MM.yyyy.
function formatDateSR(iso?: string | Date): string {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
}

// Format date for display (old version for compatibility)
function formatDate(dateString: string): string {
  return formatDateSR(dateString);
}

// Convert order type to short uppercase code
function toTypeShort(t?: string): string {
  const s = (t ?? '').toLowerCase();
  if (s === 'ctp') return 'CTP';
  if (s === 'digital') return 'DIG';
  if (s === 'film' || s === 'fil') return 'FIL';
  return 'RAZ';
}

// Map order type to short code (old version for compatibility)
function shortType(type?: string): string {
  return toTypeShort(type).toLowerCase();
}

// Generate display label for order: seq-date-type-client
function displayOrderNumber(o: {
  order_code?: string;
  created_at?: string;
  client_name?: string;
  type?: string;
}): string {
  const seq = extractSeq(o.order_code);
  const date = formatDateSR(o.created_at);
  const typ = toTypeShort(o.type);
  const cli = o.client_name ?? 'Klijent';
  return `${seq}-${date}-${typ}-${cli}`;
}

// Convert label to safe PDF filename
function toPdfFileName(label: string): string {
  const noDiacritics = label.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const safe = noDiacritics
    .replace(/\./g, '-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${safe}.pdf`;
}

// Safe filename - remove special characters (old version for compatibility)
function safeFileName(s: string): string {
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._ -]+/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

// Helper to validate font format
function isSupportedFont(bytes: ArrayBuffer) {
  const sig = String.fromCharCode(...new Uint8Array(bytes).slice(0,4));
  return sig === '\x00\x01\x00\x00' || sig === 'OTTO'; // TTF or OTF
}

// Film job computation logic (matching compute-film-job edge function)
interface FilmJobItem {
  id: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  allow_rotate_90: boolean;
}

interface ComputeResult {
  rotation_deg: number;
  m_per_piece: number;
  total_m: number;
  copies_per_row: number;
  rows_needed: number;
}

function computeSingleFilmJob(
  item: FilmJobItem,
  rollWidthMm: number,
  wastePercent: number
): ComputeResult {
  const MAX_COMPONENT_WIDTH_MM = 500;

  // Check dimensions
  if (item.width_mm > MAX_COMPONENT_WIDTH_MM || item.height_mm > MAX_COMPONENT_WIDTH_MM) {
    throw new Error(`Preširoko za rolu (max ${MAX_COMPONENT_WIDTH_MM} mm) – stavka ${item.id}`);
  }

  let best: { rotation: number; copies: number; rows: number; totalMm: number } | null = null;

  // Try 0° orientation
  const copiesPerRow0 = Math.floor(rollWidthMm / item.width_mm);
  if (copiesPerRow0 >= 1) {
    const rows0 = Math.ceil(item.qty / copiesPerRow0);
    const total0Mm = rows0 * item.height_mm;
    best = { rotation: 0, copies: copiesPerRow0, rows: rows0, totalMm: total0Mm };
  }

  // Try 90° orientation if allowed
  if (item.allow_rotate_90) {
    const copiesPerRow90 = Math.floor(rollWidthMm / item.height_mm);
    if (copiesPerRow90 >= 1) {
      const rows90 = Math.ceil(item.qty / copiesPerRow90);
      const total90Mm = rows90 * item.width_mm;
      
      if (!best || total90Mm < best.totalMm) {
        best = { rotation: 90, copies: copiesPerRow90, rows: rows90, totalMm: total90Mm };
      }
    }
  }

  if (!best) {
    throw new Error(`Preširoko za rolu (max ${MAX_COMPONENT_WIDTH_MM} mm) – stavka ${item.id}`);
  }

  // Apply waste percentage
  const totalMmWithWaste = best.totalMm * (1 + wastePercent / 100);
  
  // Ceiling to centimeter (0.01 m)
  const totalLengthM = Math.ceil(totalMmWithWaste / 10) / 100;
  const mPerPiece = totalLengthM / item.qty;

  return {
    rotation_deg: best.rotation,
    m_per_piece: Number(mPerPiece.toFixed(4)),
    total_m: Number(totalLengthM.toFixed(2)),
    copies_per_row: best.copies,
    rows_needed: best.rows
  };
}

// Ensure all film jobs have computed values before closing
async function ensureFilmComputations(supabase: any, workOrderId: string) {
  console.log(`Checking film job computations for work order ${workOrderId}...`);
  
  // Fetch film settings
  const { data: settings, error: settingsError } = await supabase
    .from('film_settings')
    .select('roll_width_mm, waste_percent')
    .single();

  if (settingsError) throw new Error('Greška pri učitavanju podešavanja filmovanja');

  const rollWidthMm = settings?.roll_width_mm || 500;
  const wastePercent = settings?.waste_percent || 3;

  // Fetch all film jobs for this order
  const { data: filmJobs, error: fetchError } = await supabase
    .from('film_jobs')
    .select('id, width_mm, height_mm, qty, allow_rotate_90, computed_total_m')
    .eq('work_order_id', workOrderId);

  if (fetchError) throw new Error('Greška pri učitavanju filmskih stavki');

  if (!filmJobs || filmJobs.length === 0) {
    console.log('No film jobs found for this order');
    return;
  }

  // Find jobs that need computation
  const jobsNeedingComputation = filmJobs.filter(
    (job: any) => !job.computed_total_m || job.computed_total_m <= 0
  );

  if (jobsNeedingComputation.length === 0) {
    console.log('All film jobs already computed');
    return;
  }

  console.log(`Computing ${jobsNeedingComputation.length} film jobs...`);

  // Compute each job and prepare updates
  const updates = [];
  for (const job of jobsNeedingComputation) {
    try {
      const result = computeSingleFilmJob(
        {
          id: job.id,
          width_mm: job.width_mm,
          height_mm: job.height_mm,
          qty: job.qty,
          allow_rotate_90: job.allow_rotate_90
        },
        rollWidthMm,
        wastePercent
      );

      updates.push({
        id: job.id,
        computed_rotation_deg: result.rotation_deg,
        computed_m_per_piece: result.m_per_piece,
        computed_total_m: result.total_m
      });

      // Also update film_cuts table
      await supabase
        .from('film_cuts')
        .delete()
        .eq('film_job_id', job.id);

      await supabase
        .from('film_cuts')
        .insert({
          film_job_id: job.id,
          rotation_deg: result.rotation_deg,
          copies_per_row: result.copies_per_row,
          rows_needed: result.rows_needed,
          length_m: result.total_m
        });

    } catch (error: any) {
      throw new Error(`Greška pri izračunavanju filmske stavke: ${error.message}`);
    }
  }

  // Update all computed jobs
  if (updates.length > 0) {
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('film_jobs')
        .update({
          computed_rotation_deg: update.computed_rotation_deg,
          computed_m_per_piece: update.computed_m_per_piece,
          computed_total_m: update.computed_total_m,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id);

      if (updateError) {
        throw new Error(`Greška pri ažuriranju filmske stavke: ${updateError.message}`);
      }
    }

    console.log(`Successfully computed ${updates.length} film jobs`);
  }
}

// Generate Work Order PDF (Radni Nalog)
async function generateWorkOrderPDF(
  workOrder: any,
  client: any,
  fileEntries: any[]
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    
    // Register fontkit for custom font support
    pdfDoc.registerFontkit(fontkit);
    
    // Fetch fonts from Supabase Storage using secrets
    const regularFontUrl = Deno.env.get('FONT_REGULAR_URL');
    const boldFontUrl = Deno.env.get('FONT_BOLD_URL');
    
    if (!regularFontUrl || !boldFontUrl) {
      throw new Error('Work Order font URLs not configured. Please set FONT_REGULAR_URL and FONT_BOLD_URL secrets.');
    }
    
    const regularFontResponse = await fetch(regularFontUrl);
    const boldFontResponse = await fetch(boldFontUrl);
    
    const regularFontBytes = await regularFontResponse.arrayBuffer();
    const boldFontBytes = await boldFontResponse.arrayBuffer();
    
    if (!isSupportedFont(regularFontBytes)) {
      throw new Error('Work Order regular font is not TTF/OTF – got wrong format (likely WOFF/HTML).');
    }
    if (!isSupportedFont(boldFontBytes)) {
      throw new Error('Work Order bold font is not TTF/OTF – got wrong format (likely WOFF/HTML).');
    }
    
    const font = await pdfDoc.embedFont(regularFontBytes, { subset: true });
    const boldFont = await pdfDoc.embedFont(boldFontBytes, { subset: true });
  
    const page = pdfDoc.addPage([595, 842]); // A4

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

  // Items (works for all order types)
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

    let itemText = entry.filename;
    if (entry.plate_formats?.format_name) {
      itemText += ` - ${entry.plate_formats.format_name} x ${entry.quantity || 0}`;
    } else if (entry.format_name) {
      itemText += ` - ${entry.format_name}`;
      if (entry.quantity) itemText += ` x ${entry.quantity}`;
      if (entry.total_meters) itemText += ` (${entry.total_meters.toFixed(2)}m)`;
      if (entry.total_sheets) itemText += ` (${entry.total_sheets} tabaka)`;
    }

    page.drawText(itemText, {
      x: margin + 10,
      y: yPos,
      size: 10,
      font: font,
    });
    yPos -= 18;
  }

  return await pdfDoc.save();
  } catch (err: any) {
    console.error('PDF generation error (Work Order):', err?.message, err?.stack);
    throw new Error(`PDF font error: ${err?.message}`);
  }
}

// Generate Delivery Note PDF (Otpremnica)
async function generateDeliveryNotePDF(
  workOrder: any,
  fileEntries: any[],
  deliveryNumber: string
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    
    // Register fontkit for custom font support
    pdfDoc.registerFontkit(fontkit);
    
    // Fetch fonts from Supabase Storage using secrets
    const regularFontUrl = Deno.env.get('FONT_REGULAR_URL');
    const boldFontUrl = Deno.env.get('FONT_BOLD_URL');
    
    if (!regularFontUrl || !boldFontUrl) {
      throw new Error('Delivery Note font URLs not configured. Please set FONT_REGULAR_URL and FONT_BOLD_URL secrets.');
    }
    
    const regularFontResponse = await fetch(regularFontUrl);
    const boldFontResponse = await fetch(boldFontUrl);
    
    const regularFontBytes = await regularFontResponse.arrayBuffer();
    const boldFontBytes = await boldFontResponse.arrayBuffer();
    
    if (!isSupportedFont(regularFontBytes)) {
      throw new Error('Delivery Note regular font is not TTF/OTF – got wrong format (likely WOFF/HTML).');
    }
    if (!isSupportedFont(boldFontBytes)) {
      throw new Error('Delivery Note bold font is not TTF/OTF – got wrong format (likely WOFF/HTML).');
    }
    
    const font = await pdfDoc.embedFont(regularFontBytes, { subset: true });
    const boldFont = await pdfDoc.embedFont(boldFontBytes, { subset: true });
  
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { height } = page.getSize();
    let yPosition = height - 50;

    page.drawText("GAMA UNITED d.o.o.", { x: 50, y: yPosition, size: 16, font: boldFont, color: rgb(0, 0, 0) });
    yPosition -= 25;
    page.drawText("Šumadijska 29, 11000 Beograd", { x: 50, y: yPosition, size: 10, font: font });
    yPosition -= 15;
    page.drawText("PIB: 112345678 | MB: 21234567", { x: 50, y: yPosition, size: 10, font: font });
    yPosition -= 40;
    page.drawText("OTPREMNICA", { x: 50, y: yPosition, size: 18, font: boldFont });
    yPosition -= 30;
    page.drawText(`Broj: ${deliveryNumber}`, { x: 50, y: yPosition, size: 12, font: font });
    yPosition -= 20;
    page.drawText(`Datum otvaranja: ${formatDate(workOrder.created_at)}`, { x: 50, y: yPosition, size: 10, font: font });
    yPosition -= 15;
    page.drawText(`Datum zatvaranja: ${formatDate(workOrder.closed_at || new Date().toISOString())}`, { x: 50, y: yPosition, size: 10, font: font });
    yPosition -= 30;
    page.drawText("Klijent:", { x: 50, y: yPosition, size: 12, font: boldFont });
    yPosition -= 20;
    page.drawText(workOrder.clients?.name || "N/A", { x: 50, y: yPosition, size: 11, font: font });

    if (workOrder.clients?.pib) {
      yPosition -= 15;
      page.drawText(`PIB: ${workOrder.clients.pib}`, { x: 50, y: yPosition, size: 10, font: font });
    }

    yPosition -= 40;
    page.drawText("Stavke:", { x: 50, y: yPosition, size: 12, font: boldFont });
    yPosition -= 25;
    
    const colWidths = [250, 150, 100];
    let xPos = 50;
    ["Naziv", "Detalji", "Količina"].forEach((header, i) => {
      page.drawText(header, { x: xPos, y: yPosition, size: 10, font: boldFont });
      xPos += colWidths[i];
    });

    yPosition -= 20;
    fileEntries.forEach((entry: any) => {
      if (yPosition < 100) return;
      xPos = 50;
      
      const filename = entry.filename || "N/A";
      let details = "";
      if (entry.plate_formats?.format_name) {
        details = entry.plate_formats.format_name;
      } else if (entry.format_name) {
        details = entry.format_name;
      }
      const quantity = String(entry.quantity || 0);
      
      [filename, details, quantity].forEach((text, i) => {
        page.drawText(text.substring(0, 30), { x: xPos, y: yPosition, size: 9, font: font });
        xPos += colWidths[i];
      });
      yPosition -= 18;
    });

    return pdfDoc.save();
  } catch (err: any) {
    console.error('PDF generation error (Delivery Note):', err?.message, err?.stack);
    throw new Error(`PDF font error: ${err?.message}`);
  }
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
    
    // Priority: RESEND_FROM > FROM_EMAIL > fallback
    let fromEmail = Deno.env.get('RESEND_FROM') || Deno.env.get('FROM_EMAIL');
    
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

    // Use fallback if neither RESEND_FROM nor FROM_EMAIL is configured
    if (!fromEmail) {
      fromEmail = 'noreply@resend.dev';
      console.warn('[closeWorkOrder] RESEND_FROM/FROM_EMAIL not set, using fallback: noreply@resend.dev (verify your domain in Resend to use custom sender)');
    } else {
      console.log('[closeWorkOrder] Using sender email:', fromEmail);
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
    
    if (!work_order_id) throw new AppError('MISSING_PARAM', 'work_order_id je obavezan');
    
    // Check for dry run mode
    const url = new URL(req.url);
    const isDryRun = url.searchParams.get('dry') === '1';
    if (isDryRun) {
      console.log('DRY RUN MODE: Will skip PDF generation and email sending');
    }

    console.log('Closing work order:', work_order_id);

    const { data: workOrder, error: fetchError } = await supabase
      .from('work_orders')
      .select('*, clients(name, email, notification_email, pib)')
      .eq('id', work_order_id)
      .single();

    if (fetchError || !workOrder) throw new AppError('ORDER_NOT_FOUND', 'Radni nalog nije pronađen');
    if (workOrder.status === 'closed') throw new AppError('ALREADY_CLOSED', 'Nalog je već zatvoren');
    
    // Validate client exists
    if (!workOrder.client_id) {
      throw new AppError('CLIENT_REQUIRED', 'Nalog nema klijenta');
    }
    
    // Get items using unified helper
    const items = await getOrderItems(supabase, work_order_id);
    
    if (items.length === 0) {
      throw new AppError('NO_ITEMS', 'Nalog mora da ima bar jednu stavku');
    }

    // For film orders, validate dimensions and ensure all jobs are computed
    if (workOrder.order_type === 'film') {
      const { data: filmJobs, error: filmErr } = await supabase
        .from('film_jobs')
        .select('id, width_mm, height_mm, qty, computed_total_m, file_name')
        .eq('work_order_id', work_order_id);
      
      if (filmErr) {
        throw new AppError('FILM_FETCH_FAILED', `Greška pri učitavanju film stavki: ${filmErr.message}`);
      }
      
      if (!filmJobs || filmJobs.length === 0) {
        throw new AppError('NO_ITEMS', 'Film nalog mora da ima bar jednu stavku');
      }
      
      // Validate dimensions and quantity
      for (const job of filmJobs) {
        if (job.width_mm < 10) {
          throw new AppError('INVALID_DIMENSIONS', `Stavka "${job.file_name}" ima širinu manju od 10mm`);
        }
        if (job.height_mm < 10) {
          throw new AppError('INVALID_DIMENSIONS', `Stavka "${job.file_name}" ima visinu manju od 10mm`);
        }
        if (job.qty < 1) {
          throw new AppError('INVALID_DIMENSIONS', `Stavka "${job.file_name}" ima količinu manju od 1`);
        }
      }
      
      // Ensure computations
      await ensureFilmComputations(supabase, work_order_id);
      
      // Verify all jobs have computed_total_m after computation
      const { data: verifyJobs, error: verifyErr } = await supabase
        .from('film_jobs')
        .select('id, computed_total_m, file_name')
        .eq('work_order_id', work_order_id);
      
      if (verifyErr) {
        throw new AppError('FILM_VERIFY_FAILED', `Greška pri proveri izračunavanja: ${verifyErr.message}`);
      }
      
      const missingComputed = verifyJobs?.filter(j => !j.computed_total_m || j.computed_total_m <= 0) || [];
      if (missingComputed.length > 0) {
        throw new AppError('FILM_COMPUTE_MISSING', `Nedostaju izračunati metri za: ${missingComputed.map(j => j.file_name).join(', ')}`);
      }
    }
    
    // If dry run, stop here after validation
    if (isDryRun) {
      console.log('DRY RUN: Validation passed, skipping actual closure');
      return new Response(
        JSON.stringify({ 
          ok: true,
          dry_run: true,
          message: 'Dry run successful - validation passed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

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

    // Items already fetched via getOrderItems() - map to PDF format
    const pdfItems = items.map(item => ({
      filename: item.label,
      format_name: item.details || '',
      quantity: item.qty,
      total_meters: item.unit === 'm' ? item.total : undefined,
      total_sheets: item.unit === 'tab' ? item.total : undefined,
      pages: item.unit === 'tab' ? undefined : undefined, // Pages info not in unified format yet
      note: item.note
    }));

    // Prepare temp directory for PDFs
    const tmpDir = "/tmp";
    await ensureDir(tmpDir);
    
    const deliveryNumber = `DN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const orderNo = workOrder.display_order_number || workOrder.order_number;
    const clientName = workOrder.clients?.name || "N/A";
    const orderType = workOrder.order_type.toUpperCase();
    const orderCode = workOrder.order_code || orderNo;
    
    // Generate order display label using new format
    const orderLabel = displayOrderNumber({
      order_code: workOrder.order_code,
      created_at: workOrder.created_at,
      client_name: clientName,
      type: workOrder.order_type
    });
    
    // Convert to safe PDF filename (returns with .pdf extension)
    const baseFileName = toPdfFileName(orderLabel); // e.g., "0005-17-11-2025-CTP-Klijent.pdf"
    const baseName = baseFileName.slice(0, -4); // Remove .pdf extension for adding suffixes
    
    // Legacy format variables (for storage paths and compatibility)
    const dateISO = new Date(workOrder.created_at).toISOString().slice(0, 10);
    const typeCode = shortType(workOrder.order_type);
    const clientSafe = safeFileName(clientName);

    // Use consistent filenames for idempotency
    const deliveryNotePath = `${tmpDir}/${baseName}_Otpremnica.pdf`;
    const workOrderPath = `${tmpDir}/${baseName}_RN.pdf`;

    // Check if PDFs already exist (idempotency within request)
    let deliveryNotePdfBytes: Uint8Array;
    let workOrderPdfBytes: Uint8Array;

    try {
      await Deno.stat(deliveryNotePath);
      console.log(`Delivery note PDF already exists, reusing: ${deliveryNotePath}`);
      deliveryNotePdfBytes = await Deno.readFile(deliveryNotePath);
    } catch {
      console.log("Generating delivery note PDF...");
      deliveryNotePdfBytes = await generateDeliveryNotePDF(workOrder, pdfItems, deliveryNumber);
      await Deno.writeFile(deliveryNotePath, deliveryNotePdfBytes);
    }

    try {
      await Deno.stat(workOrderPath);
      console.log(`Work order PDF already exists, reusing: ${workOrderPath}`);
      workOrderPdfBytes = await Deno.readFile(workOrderPath);
    } catch {
      console.log("Generating work order PDF...");
      workOrderPdfBytes = await generateWorkOrderPDF(workOrder, workOrder.clients, pdfItems);
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
      const workOrderStoragePath = `email-archive/${work_order_id}/${baseName}_RN_${timestamp}.pdf`;
      const deliveryNoteStoragePath = `email-archive/${work_order_id}/${baseName}_Otpremnica_${timestamp}.pdf`;

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
          filename: `${baseName}_RN.pdf`,
          content: workOrderBase64,
        },
        {
          filename: `${baseName}_Otpremnica.pdf`,
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
                filename: `${baseName}_Otpremnica.pdf`,
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
      items: pdfItems || [],
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
    
    // Check if it's our custom AppError with code
    if (error.name === 'AppError' && 'code' in error) {
      const appError = error as AppError;
      return new Response(
        JSON.stringify({ 
          ok: false, 
          success: false,
          error: appError.message,
          code: appError.code
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Generic error
    return new Response(
      JSON.stringify({ ok: false, success: false, error: error.message || 'Došlo je do greške' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
};

serve(handler);
