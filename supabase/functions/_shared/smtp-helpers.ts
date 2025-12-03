import { Buffer } from "node:buffer";
// @ts-ignore
(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;

import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@resend.dev';
const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

const resend = new Resend(RESEND_API_KEY);

interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  contentType?: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  includeArchive?: boolean;
  replyTo?: string;
}

/**
 * Send email using Resend API
 */
export async function sendEmailWithSMTP(options: SendEmailOptions): Promise<void> {
  const {
    to,
    subject,
    html,
    text,
    attachments = [],
    includeArchive = true,
    replyTo = ARCHIVE_EMAIL,
  } = options;

  const recipients = Array.isArray(to) ? to : [to];
  
  // Add archive email to BCC if requested and not already in recipients
  const bcc = includeArchive && ARCHIVE_EMAIL && !recipients.includes(ARCHIVE_EMAIL) ? [ARCHIVE_EMAIL] : undefined;

  console.log('[Resend] Sending email:', {
    from: FROM_EMAIL,
    to: recipients,
    bcc,
    subject,
    replyTo,
    attachmentCount: attachments.length,
  });

  try {
    const emailOptions: any = {
      from: FROM_EMAIL,
      to: recipients,
      subject,
      html,
      text: text || undefined,
      reply_to: replyTo,
    };

    if (bcc && bcc.length > 0) {
      emailOptions.bcc = bcc;
    }

    if (attachments.length > 0) {
      emailOptions.attachments = attachments.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        content_type: att.contentType || 'application/pdf',
      }));
    }

    const result = await resend.emails.send(emailOptions);
    
    if (result.error) {
      console.error('[Resend] API returned error:', result.error);
      throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
    }

    console.log('[Resend] Email sent successfully:', result.data?.id);
    console.log('[Resend] Recipients:', recipients);
    if (bcc && bcc.length > 0) {
      console.log('[Resend] BCC:', bcc);
    }
  } catch (error) {
    console.error('[Resend] Failed to send email:', error);
    throw error;
  }
}

/**
 * Fetch PDF from Supabase Storage and convert to base64
 */
async function fetchPdfAsBase64(
  sbUrl: string,
  serviceKey: string,
  bucket: string,
  path: string
): Promise<string> {
  const supabase = createClient(sbUrl, serviceKey);
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);
  
  if (error || !data) {
    console.error(`PDF fetch failed for ${bucket}/${path}:`, error);
    throw new Error(`PDF fetch failed: ${error?.message || 'File not found'}`);
  }
  
  const ab = await data.arrayBuffer();
  const pdfBuf = new Uint8Array(ab);
  return Buffer.from(pdfBuf).toString('base64');
}

interface PdfAttachment {
  bucket: string;
  path: string;
  filename: string;
}

/**
 * Send delivery note email with PDF attachment
 */
export async function sendDeliveryNoteEmail(options: {
  subject: string;
  to: string[];
  pdfBucket: string;
  pdfPath: string;
  html?: string;
  text?: string;
  sbUrl: string;
  serviceKey: string;
}): Promise<void> {
  const { subject, to, pdfBucket, pdfPath, html, text, sbUrl, serviceKey } = options;

  console.log('[sendDeliveryNoteEmail] Fetching PDF from storage...');
  const pdfBase64 = await fetchPdfAsBase64(sbUrl, serviceKey, pdfBucket, pdfPath);
  
  const filename = pdfPath.split('/').pop() || 'otpremnica.pdf';

  const defaultHtml = html || `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <p>Poštovani,</p>
        <p>U prilogu se nalazi otpremnica.</p>
        <p>Srdačan pozdrav</p>
      </body>
    </html>
  `;

  await sendEmailWithSMTP({
    to,
    subject,
    html: defaultHtml,
    text: text || 'U prilogu je otpremnica.',
    attachments: [{
      filename,
      content: pdfBase64,
      contentType: 'application/pdf',
    }],
    includeArchive: true,
    replyTo: ARCHIVE_EMAIL,
  });
}

/**
 * Send work order archive email with both work order and delivery note PDFs
 */
export async function sendWorkOrderArchiveEmail(options: {
  subject: string;
  html: string;
  workOrderPdf: PdfAttachment;
  deliveryNotePdf: PdfAttachment;
  sbUrl: string;
  serviceKey: string;
}): Promise<void> {
  const { subject, html, workOrderPdf, deliveryNotePdf, sbUrl, serviceKey } = options;

  console.log('[sendWorkOrderArchiveEmail] Fetching PDFs from storage...');
  
  const [woPdfBase64, dnPdfBase64] = await Promise.all([
    fetchPdfAsBase64(sbUrl, serviceKey, workOrderPdf.bucket, workOrderPdf.path),
    fetchPdfAsBase64(sbUrl, serviceKey, deliveryNotePdf.bucket, deliveryNotePdf.path),
  ]);

  await sendEmailWithSMTP({
    to: ARCHIVE_EMAIL,
    subject,
    html,
    attachments: [
      {
        filename: workOrderPdf.filename,
        content: woPdfBase64,
        contentType: 'application/pdf',
      },
      {
        filename: deliveryNotePdf.filename,
        content: dnPdfBase64,
        contentType: 'application/pdf',
      },
    ],
    includeArchive: false, // Already sending to archive
  });
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.error(`[retryWithBackoff] Attempt ${i + 1}/${maxRetries} failed:`, error.message);
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`[retryWithBackoff] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}
