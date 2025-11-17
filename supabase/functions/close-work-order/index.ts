import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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

async function generateDeliveryNotePDF(
  workOrder: any,
  fileEntries: any[],
  deliveryNumber: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
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

async function logEmail(supabase: any, workOrderId: string, recipientEmail: string, subject: string, status: string, errorMessage: string | null = null) {
  await supabase.from("email_log").insert({
    work_order_id: workOrderId,
    recipient_email: recipientEmail,
    subject: subject,
    status: status,
    error_message: errorMessage,
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    const archiveEmail = Deno.env.get('ARCHIVE_EMAIL');

    if (!resendApiKey || !fromEmail || !archiveEmail) {
      throw new Error('Missing email configuration');
    }

    const resend = new Resend(resendApiKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Nedostaje autorizacija');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Niste autentifikovani');

    const { work_order_id, note }: CloseWorkOrderRequest = await req.json();
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

    const deliveryNumber = `DN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const pdfBuffer = await generateDeliveryNotePDF(workOrder, fileEntries || [], deliveryNumber);

    const archiveSubject = `Arhiva – ${workOrder.display_order_number || workOrder.order_number} (${workOrder.order_type})`;
    try {
      await resend.emails.send({
        from: fromEmail,
        to: archiveEmail,
        subject: archiveSubject,
        text: `Arhiva naloga ${workOrder.display_order_number || workOrder.order_number}`,
        attachments: [{ filename: `Otpremnica-${workOrder.display_order_number || workOrder.order_number}.pdf`, content: pdfBuffer }]
      });
      await logEmail(supabase, work_order_id, archiveEmail, archiveSubject, 'success');
    } catch (error: any) {
      await logEmail(supabase, work_order_id, archiveEmail, archiveSubject, 'error', error?.message || String(error));
    }

    const clientEmail = workOrder.clients?.notification_email || workOrder.clients?.email;
    if (clientEmail) {
      const clientSubject = `Završen posao – ${workOrder.display_order_number || workOrder.order_number}`;
      try {
        await resend.emails.send({
          from: fromEmail,
          to: clientEmail,
          subject: clientSubject,
          text: `Poštovani ${workOrder.clients?.name || ''}, posao "${workOrder.job_name || workOrder.order_number}" je završen. U prilogu je otpremnica.`,
          attachments: [{ filename: `Otpremnica-${workOrder.display_order_number || workOrder.order_number}.pdf`, content: pdfBuffer }]
        });
        await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'success');
      } catch (error: any) {
        await logEmail(supabase, work_order_id, clientEmail, clientSubject, 'error', error?.message || String(error));
      }
    }

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

    return new Response(
      JSON.stringify({ success: true, message: 'Nalog uspešno zatvoren i emails poslati', work_order: updatedOrder }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Došlo je do greške' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

serve(handler);
