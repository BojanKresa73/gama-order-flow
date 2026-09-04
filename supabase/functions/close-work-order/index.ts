import { Buffer } from "node:buffer";
// @ts-ignore
(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { ensureDir } from "https://deno.land/std@0.190.0/fs/mod.ts";
import { sendEmailWithSMTP, retryWithBackoff } from "../_shared/smtp-helpers.ts";
import { generateDeliveryNotePDF } from "../_shared/delivery-note-pdf.ts";

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

async function ensureDigitalComputations(sb: any, orderId: string): Promise<void> {
  const { data: jobs, error: fetchError } = await sb
    .from('digital_jobs')
    .select('id, obim, qty, print_sides, machine_sheet_format')
    .eq('work_order_id', orderId);

  if (fetchError) {
    throw new AppError('DIGITAL_COMPUTE_FAILED', `Greška pri učitavanju digitalnih stavki: ${fetchError.message}`);
  }

  for (const job of jobs || []) {
    const obim = Math.max(1, Number(job.obim) || 1);
    const qty = Math.max(1, Number(job.qty) || 1);
    const totalSheets = obim * qty;
    const multiplier = job.machine_sheet_format === '700x330' ? 1.5 : 1;
    const printSides = job.print_sides || '4/4';
    const colorSides = printSides === '4/4' ? 2 : (printSides === '4/0' || printSides === '4/1' ? 1 : 0);
    const monoSides = printSides === '1/1' ? 2 : (printSides === '1/0' || printSides === '4/1' ? 1 : 0);

    const { error: updateError } = await sb
      .from('digital_jobs')
      .update({
        obim,
        qty,
        computed_nup: 1,
        computed_sheets_per_copy: obim,
        computed_total_sheets: totalSheets,
        computed_color_clicks: Math.round(totalSheets * colorSides * multiplier),
        computed_mono_clicks: Math.round(totalSheets * monoSides * multiplier),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateError) {
      throw new AppError('DIGITAL_COMPUTE_FAILED', `Greška pri izračunavanju stavke: ${updateError.message}`);
    }
  }
}

async function getOrderItems(sb: any, orderId: string): Promise<UiItem[]> {
  // Get work order type
  const { data: order, error: orderError } = await sb
    .from('work_orders')
    .select('id, order_type, job_name, run_quantity')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('[getOrderItems] Error fetching work order:', orderError);
    return [];
  }

  // RAZNO / Ostalo: synthetic item from work order itself
  if (order.order_type === 'other') {
    return [{
      id: order.id,
      label: order.job_name || 'Usluga',
      qty: Number(order.run_quantity) || 1,
      unit: 'kom',
      details: '',
    }];
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
      .select('id, file_name, name, finished_w_mm, finished_h_mm, qty, pages, computed_total_sheets, pieces_count, print_sides, machine_sheet_format')
      .eq('work_order_id', orderId)
      .order('order_index');

    if (error) {
      console.error('[getOrderItems] Error fetching digital jobs:', error);
      return [];
    }

    return (data || []).map((item: any) => {
      const nameForParse = String(item.name || item.file_name || '');
      const parsedPieces = nameForParse.match(/(\d+)\s*kom\b/i)?.[1];
      const pieces = Number(item.pieces_count || parsedPieces || item.qty || 1);

      return {
        id: item.id,
        label: item.file_name || item.name || 'Bez naziva',
        qty: pieces,
        unit: 'kom',
        total: item.computed_total_sheets || 0,
        details: item.machine_sheet_format || `${item.finished_w_mm}×${item.finished_h_mm} mm, ${item.pages} str`,
        note: item.print_sides || undefined,
      };
    });
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

// Film job computation logic - NO NESTING, each piece goes one below the other
// This matches src/lib/filmCalculations.ts and supabase/functions/_shared/film-calculations.ts
interface FilmJobItem {
  id: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  allow_rotate_90: boolean;
  margin_mm?: number;
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
  wastePercent: number,
  marginMm: number = 0
): ComputeResult {
  const usable = rollWidthMm - 2 * marginMm;

  const tryOrient = (o: 0 | 90) => {
    // pieceW goes along roll width, pieceH goes along roll length
    const pieceW = o === 0 ? item.width_mm : item.height_mm;
    const pieceH = o === 0 ? item.height_mm : item.width_mm;

    // Check if it fits in roll width
    if (pieceW > usable) return null;

    // No nesting - each piece goes one below the other
    const across = 1;
    const rows = item.qty;
    const m_per_piece = pieceH / 1000;
    const total_m_raw = rows * m_per_piece;
    const total_m = total_m_raw * (1 + wastePercent / 100);

    return { orientation: o, across, rows, m_per_piece, total_m };
  };

  const o0 = tryOrient(0);
  const o90 = item.allow_rotate_90 ? tryOrient(90) : null;

  if (!o0 && !o90) {
    throw new Error(`NE_STAJE_U_ROLNU - stavka ${item.id} ne staje u širinu rolne (${usable}mm)`);
  }

  let best = o0;
  if (o0 && o90) {
    // Both orientations fit - choose the more economical one (smaller total_m)
    if (o90.total_m < o0.total_m) best = o90;
  } else if (!o0 && o90) {
    best = o90;
  }

  return {
    rotation_deg: best!.orientation,
    m_per_piece: Number(best!.m_per_piece.toFixed(4)),
    total_m: Number(best!.total_m.toFixed(4)),
    copies_per_row: best!.across,
    rows_needed: best!.rows
  };
}

// Ensure all film jobs have computed values before closing
async function ensureFilmComputations(supabase: any, workOrderId: string) {
  console.log(`Checking film job computations for work order ${workOrderId}...`);
  
  // Fetch film settings
  const { data: settings, error: settingsError } = await supabase
    .from('film_settings')
    .select('roll_width_mm, waste_percent, side_margin_mm')
    .single();

  if (settingsError) throw new Error('Greška pri učitavanju podešavanja filmovanja');

  const rollWidthMm = settings?.roll_width_mm || 500;
  const wastePercent = settings?.waste_percent || 3;

  // Fetch all film jobs for this order (include margin_mm)
  const { data: filmJobs, error: fetchError } = await supabase
    .from('film_jobs')
    .select('id, width_mm, height_mm, qty, allow_rotate_90, margin_mm, computed_total_m')
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
      // Use job's margin_mm or default from settings
      const marginMm = job.margin_mm ?? settings?.side_margin_mm ?? 0;
      
      const result = computeSingleFilmJob(
        {
          id: job.id,
          width_mm: job.width_mm,
          height_mm: job.height_mm,
          qty: job.qty,
          allow_rotate_90: job.allow_rotate_90,
          margin_mm: marginMm
        },
        rollWidthMm,
        wastePercent,
        marginMm
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
  page.drawText(`Broj naloga: ${workOrder.order_number}`, {
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

// Email logging helper
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
    // Get environment configuration
    const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL');
    
    if (!ARCHIVE_EMAIL) {
      console.error('[closeWorkOrder] Missing ARCHIVE_EMAIL configuration');
      return new Response(
        JSON.stringify({ ok: false, error: 'Nedostaje ARCHIVE_EMAIL konfiguracija' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    
    // Validate that order can be closed
    if (!workOrder.client_id) {
      throw new AppError('CLIENT_REQUIRED', 'Nalog nema klijenta');
    }

    if (workOrder.order_type === 'digital') {
      await ensureDigitalComputations(supabase, work_order_id);
    }
    
    // Get items using unified helper
    const items = await getOrderItems(supabase, work_order_id);
    
    console.log(`[closeWorkOrder] Order type: ${workOrder.order_type}, Items found: ${items.length}`);
    
    if (items.length === 0) {
      // Log more details for debugging
      console.error(`[closeWorkOrder] NO_ITEMS error for order ${work_order_id}, type: ${workOrder.order_type}`);
      
      // Check which table should have items
      if (workOrder.order_type === 'film') {
        const { data: filmJobs, error } = await supabase
          .from('film_jobs')
          .select('id')
          .eq('work_order_id', work_order_id);
        console.error(`[closeWorkOrder] film_jobs check: ${filmJobs?.length || 0} rows, error:`, error);
      } else if (workOrder.order_type === 'digital') {
        const { data: digitalJobs, error } = await supabase
          .from('digital_jobs')
          .select('id')
          .eq('work_order_id', work_order_id);
        console.error(`[closeWorkOrder] digital_jobs check: ${digitalJobs?.length || 0} rows, error:`, error);
      } else if (workOrder.order_type === 'ctp') {
        const { data: fileEntries, error } = await supabase
          .from('file_entries')
          .select('id')
          .eq('work_order_id', work_order_id);
        console.error(`[closeWorkOrder] file_entries check: ${fileEntries?.length || 0} rows, error:`, error);
      }
      
      throw new AppError('NO_ITEMS', 'Nalog mora da ima bar jednu stavku');
    }

    // Validate order-type specific requirements
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
    
    // Validate digital orders
    if (workOrder.order_type === 'digital') {
      const { data: digitalJobs, error: digitalErr } = await supabase
        .from('digital_jobs')
        .select('id, file_name, computed_total_sheets, qty')
        .eq('work_order_id', work_order_id);
      
      if (digitalErr) {
        throw new AppError('DIGITAL_FETCH_FAILED', `Greška pri učitavanju digitalnih stavki: ${digitalErr.message}`);
      }
      
      if (!digitalJobs || digitalJobs.length === 0) {
        throw new AppError('NO_ITEMS', 'Digitalni nalog mora da ima bar jednu stavku');
      }
      
      // Validate computed sheets
      for (const job of digitalJobs) {
        if (!job.computed_total_sheets || job.computed_total_sheets <= 0) {
          throw new AppError('DIGITAL_NOT_COMPUTED', `Stavka "${job.file_name}" nema izračunat broj tabaka. Popuni sve podatke (format, strane, količina).`);
        }
        if (!job.qty || job.qty < 1) {
          throw new AppError('INVALID_QUANTITY', `Stavka "${job.file_name}" ima količinu manju od 1`);
        }
      }
    }
    
    // Validate CTP orders
    if (workOrder.order_type === 'ctp') {
      const { data: fileEntries, error: ctpErr } = await supabase
        .from('file_entries')
        .select('id, filename, quantity')
        .eq('work_order_id', work_order_id);
      
      if (ctpErr) {
        throw new AppError('CTP_FETCH_FAILED', `Greška pri učitavanju CTP stavki: ${ctpErr.message}`);
      }
      
      if (!fileEntries || fileEntries.length === 0) {
        throw new AppError('NO_ITEMS', 'CTP nalog mora da ima bar jednu stavku');
      }
      
      // Validate quantity for each file entry
      for (const entry of fileEntries) {
        if (!entry.quantity || entry.quantity < 1) {
          throw new AppError('INVALID_QUANTITY', `Stavka "${entry.filename}" mora da ima količinu veću od 0`);
        }
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
      total_sheets: workOrder.order_type === 'digital' ? item.total : undefined,
      pages: undefined,
      note: item.note
    }));

    // Prepare temp directory for PDFs
    const tmpDir = "/tmp";
    await ensureDir(tmpDir);
    
    // Use work order number as delivery number (order_number is the correct format)
    const orderNo = workOrder.order_number;
    const deliveryNumber = orderNo;
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
      // Transform pdfItems to format expected by shared generateDeliveryNotePDF
      const fileEntriesForPdf = pdfItems.map(item => ({
        filename: item.filename,
        quantity: item.quantity,
        pieces_count: workOrder.order_type === 'digital' ? item.quantity : undefined,
        file_type: workOrder.order_type === 'digital' ? 'digital_sheet' : undefined,
        plate_formats: item.format_name ? { format_name: item.format_name } : null
      }));
      deliveryNotePdfBytes = await generateDeliveryNotePDF(workOrder, fileEntriesForPdf);
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

    // Calculate total attachment size
    const totalSizeBytes = deliveryNotePdfBytes.length + workOrderPdfBytes.length;
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    const MAX_SIZE_MB = 8;
    console.log(`Total attachment size: ${totalSizeMB.toFixed(2)} MB`);

    // Upload PDFs to storage (for all cases)
    const timestamp = Date.now();
    const workOrderStoragePath = `email-archive/${work_order_id}/${baseName}_RN_${timestamp}.pdf`;
    const deliveryNoteStoragePath = `email-archive/${work_order_id}/${baseName}_Otpremnica_${timestamp}.pdf`;

    console.log("Uploading PDFs to Storage...");
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
    console.log("PDFs uploaded successfully");

    // Get user who closed the order
    const { data: closedByUser } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    const closedByName = closedByUser?.full_name || 'N/A';
    const closedAtFormatted = formatDate(workOrder.closed_at || new Date().toISOString());

    const archiveEmailBody = `
      <p>Arhiva – zatvoreni nalog ${orderNo} (${orderType})</p>
      <p>Klijent: ${clientName}</p>
      <p>Zatvorio: ${closedByName} u ${closedAtFormatted}</p>
    `;

    const clientEmail = (workOrder.sales_rep_email || '').trim()
      || workOrder.clients?.notification_email
      || workOrder.clients?.email;
    let clientEmailStatus = 'skipped';
    let clientEmailMessage = '';
    
    // Check if attachments exceed 8 MB
    if (totalSizeMB > MAX_SIZE_MB) {
      console.log(`Attachments exceed ${MAX_SIZE_MB} MB, sending download links...`);

      // Generate signed URLs (60 minutes)
      const { data: workOrderUrl } = await supabase.storage
        .from('email-archive')
        .createSignedUrl(workOrderStoragePath, 3600);

      const { data: deliveryNoteUrl } = await supabase.storage
        .from('email-archive')
        .createSignedUrl(deliveryNoteStoragePath, 3600);

      // Send archive email with links
      const archiveEmailBodyWithLinks = `
        ${archiveEmailBody}
        <br>
        <p>Prilozi su preveliki za email (${totalSizeMB.toFixed(2)} MB). Preuzmite fajlove putem linkova ispod:</p>
        <ul>
          <li><a href="${workOrderUrl?.signedUrl}">Radni Nalog - ${orderNo}</a> (važi 60 minuta)</li>
          <li><a href="${deliveryNoteUrl?.signedUrl}">Otpremnica - ${orderNo}</a> (važi 60 minuta)</li>
        </ul>
      `;

      console.log(`Sending archive email with links to ${ARCHIVE_EMAIL}...`);
      const archiveSubject = `[RNGU] ${orderNo} – ${clientName} – ${orderType} CLOSED`;
      try {
        await retryWithBackoff(async () => {
          return await sendEmailWithSMTP({
            to: ARCHIVE_EMAIL,
            subject: archiveSubject,
            html: archiveEmailBodyWithLinks,
            replyTo: ARCHIVE_EMAIL,
            includeArchive: false,
          });
        });
        await logEmail(supabase, work_order_id, ARCHIVE_EMAIL, archiveSubject, 'archive', 'sent', null);
        console.log("Archive email with links sent successfully");
      } catch (error: any) {
        console.error("Failed to send archive email after retries:", error);
        await logEmail(supabase, work_order_id, ARCHIVE_EMAIL, archiveSubject, 'archive', 'error', error?.message || String(error));
      }
      
      // Send client email with link
      if (!clientEmail) {
        console.warn(`[closeWorkOrder] Client email missing, skipping`);
        clientEmailMessage = 'Klijent nema email adresu';
      } else {
        const clientSubject = `Završen posao – ${clientName} – ${orderNo}`;
        const clientEmailBodyWithLink = `
          <p>Poštovani/na ${clientName},</p>
          <br>
          <p>Obaveštavamo vas da je posao <strong>${orderNo}</strong> (${orderType}) završen.</p>
          <p>Otpremnicu možete preuzeti putem linka ispod (važi 60 minuta):</p>
          <p><a href="${deliveryNoteUrl?.signedUrl}">Preuzmi otpremnicu</a></p>
          <p>Ovaj mail je automatski generisan i operateri ne odgovaraju na dodatna pitanja, za kontakt koristite: <a href="mailto:ctp@gamaunited.rs">ctp@gamaunited.rs</a></p>
          <br>
          <p>Srdačno,<br><strong>GAMA UNITED</strong></p>
        `;
        
        try {
          await retryWithBackoff(async () => {
            return await sendEmailWithSMTP({
              to: clientEmail,
              subject: clientSubject,
              html: clientEmailBodyWithLink,
              replyTo: ARCHIVE_EMAIL,
              includeArchive: true,
            });
          });
          await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'client', 'sent', null);
          console.log("Client email with link sent successfully");
          clientEmailStatus = 'sent';
        } catch (error: any) {
          console.error("Failed to send client email after retries:", error);
          await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'client', 'error', error?.message || String(error));
          clientEmailStatus = 'error';
          clientEmailMessage = 'Greška pri slanju klijentskog mejla';
        }
      }
    } else {
      // Use email helpers to send attachments from storage (<8MB)
      console.log("Sending emails with attachments from storage...");

      // Send archive email with both PDFs
      console.log(`Sending archive email to ${ARCHIVE_EMAIL}...`);
      const archiveSubject = `[RNGU] ${orderNo} – ${clientName} – ${orderType} CLOSED`;
      try {
        await retryWithBackoff(async () => {
          // Fetch PDFs from storage
          const { data: woData, error: woError } = await supabase.storage
            .from('email-archive')
            .download(workOrderStoragePath);
          
          const { data: dnData, error: dnError } = await supabase.storage
            .from('email-archive')
            .download(deliveryNoteStoragePath);
          
          if (woError || !woData) throw new Error(`Failed to fetch work order PDF: ${woError?.message}`);
          if (dnError || !dnData) throw new Error(`Failed to fetch delivery note PDF: ${dnError?.message}`);
          
          const woBytes = new Uint8Array(await woData.arrayBuffer());
          const dnBytes = new Uint8Array(await dnData.arrayBuffer());
          
          // Convert to base64 for SMTP helper
          const woBase64 = Buffer.from(woBytes).toString('base64');
          const dnBase64 = Buffer.from(dnBytes).toString('base64');
          
          return await sendEmailWithSMTP({
            to: ARCHIVE_EMAIL,
            subject: archiveSubject,
            html: archiveEmailBody,
            replyTo: ARCHIVE_EMAIL,
            includeArchive: false,
            attachments: [
              {
                filename: `${baseName}_RN.pdf`,
                content: woBase64,
                contentType: 'application/pdf',
              },
              {
                filename: `${baseName}_Otpremnica.pdf`,
                content: dnBase64,
                contentType: 'application/pdf',
              },
            ],
          });
        });
        await logEmail(supabase, work_order_id, ARCHIVE_EMAIL, archiveSubject, 'archive', 'sent', null);
        console.log("Archive email sent successfully");
      } catch (error: any) {
        console.error("Failed to send archive email after retries:", error);
        await logEmail(supabase, work_order_id, ARCHIVE_EMAIL, archiveSubject, 'archive', 'error', error?.message || String(error));
      }

      // Send client email (only delivery note)
      if (!clientEmail) {
        console.warn(`[closeWorkOrder] Client email missing, skipping`);
        clientEmailMessage = 'Klijent nema email adresu';
      } else {
        console.log(`Sending client email to ${clientEmail}...`);
        const clientSubject = `Završen posao – ${clientName} – ${orderNo}`;
        const clientEmailHtml = `
          <p>Poštovani/na ${clientName},</p>
          <br>
          <p>Obaveštavamo vas da je posao <strong>${orderNo}</strong> (${orderType}) završen.</p>
          <p>U prilogu je otpremnica.</p>
          <p>Ovaj mail je automatski generisan i operateri ne odgovaraju na dodatna pitanja, za kontakt koristite: <a href="mailto:ctp@gamaunited.rs">ctp@gamaunited.rs</a></p>
          <br>
          <p>Srdačno,<br><strong>GAMA UNITED</strong></p>
        `;

        try {
          await retryWithBackoff(async () => {
            // Fetch PDF from storage
            const { data: pdfData, error: pdfError } = await supabase.storage
              .from('email-archive')
              .download(deliveryNoteStoragePath);
            
            if (pdfError || !pdfData) throw new Error(`Failed to fetch delivery note PDF: ${pdfError?.message}`);
            
            const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
            
            // Convert to base64 for SMTP helper
            const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
            
            return await sendEmailWithSMTP({
              to: clientEmail,
              subject: clientSubject,
              html: clientEmailHtml,
              replyTo: ARCHIVE_EMAIL,
              includeArchive: true,
              attachments: [
                {
                  filename: `Otpremnica_${baseName}.pdf`,
                  content: pdfBase64,
                  contentType: 'application/pdf',
                },
              ],
            });
          });
          await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'client', 'sent', null);
          console.log("Client email sent successfully");
          clientEmailStatus = 'sent';
        } catch (error: any) {
          console.error("Failed to send client email after retries:", error);
          
          // Queue for retry in email_outbox
          await supabase.from('email_outbox').insert({
            work_order_id: work_order_id,
            email_type: 'delivery_note',
            recipient_emails: [clientEmail],
            subject: clientSubject,
            pdf_bucket: 'email-archive',
            pdf_path: deliveryNoteStoragePath,
            try_count: 0,
            last_error: error?.message || String(error),
            next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // retry in 5 minutes
          });
          console.log("Email queued in outbox for retry");
          
          await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'client', 'queued_retry', error?.message || String(error));
          clientEmailStatus = 'queued';
          clientEmailMessage = 'Email dodat u red za slanje';
        }
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
      work_order_number: orderNo,
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

    // Notify portal users about order closure (fire and forget)
    try {
      const orderLabel = workOrder.display_order_number || workOrder.order_code || work_order_id;
      const clientName = workOrder.clients?.name || 'Klijent';
      await supabase.from('portal_notifications').insert({
        client_id: workOrder.client_id,
        work_order_id: work_order_id,
        event_type: 'closed',
        title: `Nalog ${orderLabel} zatvoren`,
        message: `Nalog za ${clientName} je zatvoren.`,
      });
    } catch (notifyErr) {
      console.error('Portal notification on close failed (non-blocking):', notifyErr);
    }

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
        clientEmailStatus,
        delivery_note_sent: clientEmailStatus === 'sent'
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
