import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM_EMAIL = Deno.env.get('FROM_EMAIL')!;
const ARCHIVE_EMAIL = Deno.env.get('ARCHIVE_EMAIL')!;
const SMTP_HOST = Deno.env.get('SMTP_HOST')!;
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465');
const SMTP_USER = Deno.env.get('SMTP_USER')!;
const SMTP_PASS = Deno.env.get('SMTP_PASS')!;

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
 * Send email using Gmail SMTP
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
  
  // Add archive email if requested and not already in recipients
  if (includeArchive && !recipients.includes(ARCHIVE_EMAIL)) {
    recipients.push(ARCHIVE_EMAIL);
  }

  console.log('[SMTP] Sending email:', {
    from: FROM_EMAIL,
    to: recipients,
    subject,
    replyTo,
    attachmentCount: attachments.length,
  });

  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: true,
      auth: {
        username: SMTP_USER,
        password: SMTP_PASS,
      },
    },
  });

  try {
    await client.send({
      from: FROM_EMAIL,
      to: recipients.join(', '),
      replyTo: replyTo,
      subject,
      content: text || html,
      html,
      attachments: attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || 'application/pdf',
        encoding: 'base64',
      })),
    });

    console.log('[SMTP] Email sent successfully to:', recipients);
  } catch (error) {
    console.error('[SMTP] Failed to send email:', error);
    throw error;
  } finally {
    await client.close();
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
  let binary = '';
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
  html: string;
  text?: string;
  sbUrl: string;
  serviceKey: string;
}): Promise<void> {
  const { subject, to, pdfBucket, pdfPath, html, text, sbUrl, serviceKey } = options;

  console.log('[sendDeliveryNoteEmail] Fetching PDF from storage...');
  const pdfBase64 = await fetchPdfAsBase64(sbUrl, serviceKey, pdfBucket, pdfPath);
  
  const filename = pdfPath.split('/').pop() || 'otpremnica.pdf';

  await sendEmailWithSMTP({
    to,
    subject,
    html,
    text,
    attachments: [{
      filename,
      content: pdfBase64,
      contentType: 'application/pdf',
    }],
    includeArchive: true,
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
