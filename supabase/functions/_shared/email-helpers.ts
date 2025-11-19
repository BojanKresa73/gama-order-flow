import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const FROM = Deno.env.get('RESEND_FROM') || Deno.env.get('FROM_EMAIL') || 'noreply@resend.dev';
const ARCHIVE = Deno.env.get('ARCHIVE_EMAIL')!;

interface PdfAttachment {
  bucket: string;
  path: string;
  filename: string;
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
  const url = `${sbUrl}/storage/v1/object/public/${bucket}/${path}?download=1`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${serviceKey}` },
    cache: 'no-store',
  });
  
  if (!resp.ok) {
    throw new Error(`PDF fetch failed: ${resp.status} ${resp.statusText}`);
  }
  
  const ab = await resp.arrayBuffer();
  
  // Convert ArrayBuffer to base64
  let binary = '';
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Send email with PDF attachments from Supabase Storage
 * Automatically includes ARCHIVE_EMAIL in recipients
 */
export async function sendEmailWithPdfs({
  to,
  subject,
  html,
  text,
  pdfs,
  sbUrl,
  serviceKey,
  includeArchive = true,
}: {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  pdfs: PdfAttachment[];
  sbUrl: string;
  serviceKey: string;
  includeArchive?: boolean;
}): Promise<any> {
  // Fetch all PDFs and convert to base64
  const attachments = await Promise.all(
    pdfs.map(async (pdf) => {
      const b64 = await fetchPdfAsBase64(sbUrl, serviceKey, pdf.bucket, pdf.path);
      return {
        filename: pdf.filename,
        content: b64,
        type: 'application/pdf',
      };
    })
  );

  // Add archive email to recipients if requested
  const recipients = includeArchive 
    ? [...to, ARCHIVE].filter(Boolean)
    : to;

  const emailOptions: any = {
    from: FROM,
    to: recipients,
    subject,
    attachments,
  };
  
  if (html) emailOptions.html = html;
  if (text) emailOptions.text = text;
  
  return await resend.emails.send(emailOptions);
}

/**
 * Send delivery note email to client (and archive)
 */
export async function sendDeliveryNoteEmail({
  subject,
  to,
  pdfBucket,
  pdfPath,
  sbUrl,
  serviceKey,
  html,
  text,
}: {
  subject: string;
  to: string[];
  pdfBucket: string;
  pdfPath: string;
  sbUrl: string;
  serviceKey: string;
  html?: string;
  text?: string;
}): Promise<any> {
  return await sendEmailWithPdfs({
    to,
    subject,
    html,
    text: text || 'U prilogu je otpremnica.',
    pdfs: [{
      bucket: pdfBucket,
      path: pdfPath,
      filename: 'Otpremnica.pdf',
    }],
    sbUrl,
    serviceKey,
    includeArchive: true,
  });
}

/**
 * Send work order archive email with both PDFs
 */
export async function sendWorkOrderArchiveEmail({
  subject,
  html,
  workOrderPdf,
  deliveryNotePdf,
  sbUrl,
  serviceKey,
}: {
  subject: string;
  html: string;
  workOrderPdf: { bucket: string; path: string; filename: string };
  deliveryNotePdf: { bucket: string; path: string; filename: string };
  sbUrl: string;
  serviceKey: string;
}): Promise<any> {
  return await sendEmailWithPdfs({
    to: [ARCHIVE],
    subject,
    html,
    pdfs: [workOrderPdf, deliveryNotePdf],
    sbUrl,
    serviceKey,
    includeArchive: false, // Already sending to archive
  });
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
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
