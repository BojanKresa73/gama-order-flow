/**
 * Email provider abstraction - supports Resend and SMTP
 * Switches based on EMAIL_PROVIDER environment variable
 */

import { Buffer } from "node:buffer";
// @ts-ignore
(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;

import { Resend } from "https://esm.sh/resend@3.5.0";
import nodemailer from "https://esm.sh/nodemailer@6.9.7";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Uint8Array | string;
    contentType?: string;
  }>;
  replyTo?: string;
}

interface ProviderConfig {
  provider: "resend" | "smtp";
  resend?: {
    apiKey: string;
    from: string;
    replyTo?: string;
    archiveEmail?: string;
  };
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
}

function getProviderConfig(): ProviderConfig {
  const provider = (Deno.env.get("EMAIL_PROVIDER") || "resend") as "resend" | "smtp";

  if (provider === "resend") {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("FROM_EMAIL");

    if (!apiKey || !from) {
      throw new Error("Resend nije konfigurisan: nedostaje RESEND_API_KEY ili FROM_EMAIL");
    }

    return {
      provider: "resend",
      resend: {
        apiKey,
        from,
        replyTo: Deno.env.get("REPLY_TO"),
        archiveEmail: Deno.env.get("ARCHIVE_EMAIL"),
      },
    };
  }

  // SMTP provider
  const host = Deno.env.get("SMTP_HOST");
  const port = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("FROM_EMAIL");

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP nije konfigurisan: nedostaju SMTP_HOST, SMTP_USER, SMTP_PASS ili FROM_EMAIL");
  }

  return {
    provider: "smtp",
    smtp: {
      host,
      port,
      user,
      pass,
      from,
    },
  };
}

async function sendViaResend(options: EmailOptions, config: ProviderConfig): Promise<void> {
  if (!config.resend) {
    throw new Error("Resend config missing");
  }

  const resend = new Resend(config.resend.apiKey);

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const bcc = config.resend.archiveEmail ? [config.resend.archiveEmail] : undefined;

  const emailData: any = {
    from: config.resend.from,
    to: recipients,
    bcc,
    subject: options.subject,
    html: options.html || options.text || "",
    text: options.text,
    reply_to: options.replyTo || config.resend.replyTo,
  };

  // Resend attachments format
  if (options.attachments && options.attachments.length > 0) {
    emailData.attachments = options.attachments.map((att) => ({
      filename: att.filename,
      content: att.content instanceof Uint8Array 
        ? Buffer.from(att.content).toString("base64")
        : att.content,
    }));
  }

  const result = await resend.emails.send(emailData);
  
  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }

  console.log("Email sent via Resend:", result.data?.id);
}

async function sendViaSmtp(options: EmailOptions, config: ProviderConfig): Promise<void> {
  if (!config.smtp) {
    throw new Error("SMTP config missing");
  }

  const { host, port, user, pass, from } = config.smtp;

  // Determine security based on port
  const secure = port === 465;
  const requireTLS = port === 587;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  const mailOptions: any = {
    from,
    to: recipients.join(", "),
    subject: options.subject,
    text: options.text || "",
    html: options.html || "",
    replyTo: options.replyTo,
  };

  if (options.attachments && options.attachments.length > 0) {
    mailOptions.attachments = options.attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));
  }

  const info = await transporter.sendMail(mailOptions);
  console.log("Email sent via SMTP:", info.messageId);
}

/**
 * Send email using configured provider (Resend or SMTP)
 */
export async function sendMail(options: EmailOptions): Promise<void> {
  const config = getProviderConfig();

  console.log(`Sending email via ${config.provider} to:`, options.to);

  if (config.provider === "resend") {
    await sendViaResend(options, config);
  } else {
    await sendViaSmtp(options, config);
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed:`, error);

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
