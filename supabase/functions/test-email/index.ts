// Supabase Edge Functions run on Deno runtime (not Node.js)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

// Helper to encode Serbian text (replaces unsupported chars with ASCII equivalents)
function encodeSerbianText(text: string): string {
  const map: Record<string, string> = {
    'č': 'c', 'Č': 'C', 'ć': 'c', 'Ć': 'C',
    'š': 's', 'Š': 'S', 'ž': 'z', 'Ž': 'Z',
    'đ': 'd', 'Đ': 'D'
  };
  return text.replace(/[čČćĆšŠžŽđĐ]/g, (m) => map[m] || m);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables FIRST
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const archiveEmail = Deno.env.get('ARCHIVE_EMAIL');
    let fromEmail = Deno.env.get('FROM_EMAIL');
    
    if (!resendApiKey) {
      console.error('[test-email] Missing RESEND_API_KEY');
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing RESEND_API_KEY environment variable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    if (!archiveEmail) {
      console.error('[test-email] Missing ARCHIVE_EMAIL');
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing ARCHIVE_EMAIL environment variable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Use fallback if FROM_EMAIL is not configured (domain not verified in Resend)
    if (!fromEmail) {
      fromEmail = 'noreply@resend.dev';
      console.warn('[test-email] FROM_EMAIL not set, using fallback: noreply@resend.dev (verify your domain in Resend to use custom sender)');
    } else {
      console.log('[test-email] Using FROM_EMAIL:', fromEmail);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Get authenticated user and check admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing authorization' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin or superuser role
    const { data: roleData } = await supabase.rpc('current_user_role');
    if (roleData !== 'admin' && roleData !== 'superuser') {
      return new Response(JSON.stringify({ ok: false, error: 'Admin access required' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const orderId = url.searchParams.get('orderId');
    const toEmail = url.searchParams.get('to');

    if (!orderId || !toEmail) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing orderId or to parameter' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Test email requested for order ${orderId} to ${toEmail}`);

    // Get work order data
    const { data: order, error: orderError } = await supabase
      .from('work_orders')
      .select(`
        *,
        clients (
          id,
          name,
          email,
          pib,
          adresa,
          grad,
          postanski_broj,
          drzava
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[test-email]', { orderId, error: 'Order not found', orderError });
      return new Response(JSON.stringify({ ok: false, error: 'Order not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get delivery items based on order type
    let deliveryItems: any[] = [];
    
    if (order.order_type === 'ctp') {
      const { data: fileEntries } = await supabase
        .from('file_entries')
        .select('*, plate_formats(format_name)')
        .eq('work_order_id', orderId);
      
      deliveryItems = (fileEntries || []).map((f: any) => ({
        filename: f.filename,
        format: f.plate_formats?.format_name || 'N/A',
        quantity: f.quantity || 0,
      }));
    } else if (order.order_type === 'digital') {
      const { data: digitalJobs } = await supabase
        .from('digital_jobs')
        .select('*')
        .eq('work_order_id', orderId)
        .order('order_index');
      
      deliveryItems = (digitalJobs || []).map((j: any) => ({
        filename: j.file_name,
        format: `${j.finished_w_mm}×${j.finished_h_mm}mm`,
        quantity: j.qty,
      }));
    } else if (order.order_type === 'film') {
      const { data: filmJobs } = await supabase
        .from('film_jobs')
        .select('*')
        .eq('work_order_id', orderId);
      
      deliveryItems = (filmJobs || []).map((j: any) => ({
        filename: j.file_name,
        format: `${j.width_mm}×${j.height_mm}mm`,
        quantity: j.qty,
      }));
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPos = 800;

    page.drawText(encodeSerbianText('OTPREMNICA'), { x: 50, y: yPos, size: 20, font: boldFont });
    yPos -= 40;

    page.drawText(encodeSerbianText(`Broj naloga: ${order.display_order_number || order.order_number}`), {
      x: 50, y: yPos, size: 12, font
    });
    yPos -= 20;

    page.drawText(encodeSerbianText(`Klijent: ${order.clients.name}`), { x: 50, y: yPos, size: 12, font });
    yPos -= 20;

    if (order.clients.pib) {
      page.drawText(encodeSerbianText(`PIB: ${order.clients.pib}`), { x: 50, y: yPos, size: 12, font });
      yPos -= 20;
    }

    const address = [
      order.clients.adresa,
      order.clients.postanski_broj ? `${order.clients.postanski_broj} ${order.clients.grad}` : order.clients.grad,
      order.clients.drzava
    ].filter(Boolean).join(', ');

    if (address) {
      page.drawText(encodeSerbianText(`Adresa: ${address}`), { x: 50, y: yPos, size: 10, font });
      yPos -= 25;
    }

    page.drawText(encodeSerbianText('Stavke:'), { x: 50, y: yPos, size: 12, font: boldFont });
    yPos -= 20;

    for (const item of deliveryItems) {
      page.drawText(encodeSerbianText(`• ${item.filename} - ${item.format} (${item.quantity}x)`), {
        x: 60, y: yPos, size: 10, font
      });
      yPos -= 18;
    }

    yPos -= 20;
    page.drawText(encodeSerbianText(`Datum: ${new Date().toLocaleDateString('sr-RS')}`), {
      x: 50, y: yPos, size: 10, font
    });

    const pdfBytes = await pdfDoc.save();
    
    // Write PDF to /tmp
    const pdfPath = `/tmp/Otpremnica_${order.display_order_number || order.order_number}.pdf`;
    await Deno.writeFile(pdfPath, pdfBytes);

    // Send emails (using already validated env vars from top of try block)
    const clientSubject = `[TEST] Nalog ${order.display_order_number || order.order_number} završen`;
    const clientHtml = `
      <p><strong>OVO JE TEST EMAIL</strong></p>
      <p>Poštovani,</p>
      <p>Vaš nalog <strong>${order.display_order_number || order.order_number}</strong> je završen.</p>
      <p>Hvala na poverenju,<br><strong>Gama United</strong></p>
    `;

    // Send to test address (client email)
    // Read PDF from /tmp
    const pdfContent = await Deno.readFile(pdfPath);
    
    const { error: clientEmailError } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: clientSubject,
      html: clientHtml,
      attachments: [{
        filename: `otpremnica-${order.display_order_number || order.order_number}.pdf`,
        content: btoa(String.fromCharCode(...pdfContent)),
      }],
    });

    if (clientEmailError) {
      console.error('Client email error:', clientEmailError);
      throw clientEmailError;
    }

    // Send to archive (also to test address)
    const archiveSubject = `[TEST] Arhiva: ${order.display_order_number || order.order_number}`;
    const archiveHtml = `
      <p><strong>OVO JE TEST EMAIL</strong></p>
      <p>Arhivski primerak otpremnice za nalog ${order.display_order_number || order.order_number}</p>
    `;

    // Read PDF from /tmp
    const pdfContent2 = await Deno.readFile(pdfPath);
    
    const { error: archiveEmailError } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: archiveSubject,
      html: archiveHtml,
      attachments: [{
        filename: `otpremnica-${order.display_order_number || order.order_number}.pdf`,
        content: btoa(String.fromCharCode(...pdfContent2)),
      }],
    });

    if (archiveEmailError) {
      console.error('Archive email error:', archiveEmailError);
      throw archiveEmailError;
    }

    // Clean up temporary PDF file
    await Deno.remove(pdfPath).catch(() => {});

    console.log(`Test emails sent successfully to ${toEmail}`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Test emails sent to ${toEmail}`,
        orderId,
        orderNumber: order.display_order_number || order.order_number,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    const orderId = new URL(req.url).searchParams.get('orderId');
    console.error('[test-email]', { orderId, error: error?.message || error });
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Internal server error' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
