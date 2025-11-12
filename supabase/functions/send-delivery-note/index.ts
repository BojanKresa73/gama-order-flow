import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeliveryNoteRequest {
  workOrderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { workOrderId }: DeliveryNoteRequest = await req.json();

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
          notification_email
        )
      `)
      .eq("id", workOrderId)
      .single();

    if (woError || !workOrder) {
      console.error("Error fetching work order:", woError);
      throw new Error("Work order not found");
    }

    // Fetch file entries
    const { data: fileEntries, error: feError } = await supabaseClient
      .from("file_entries")
      .select("*")
      .eq("work_order_id", workOrderId)
      .eq("status", "closed");

    if (feError) {
      console.error("Error fetching file entries:", feError);
      throw new Error("Error fetching file entries");
    }

    if (!fileEntries || fileEntries.length === 0) {
      throw new Error("No closed file entries found for this work order");
    }

    // Generate delivery number
    const { count: deliveryCount } = await supabaseClient
      .from("delivery_notes")
      .select("id", { count: "exact", head: true });

    const deliveryNumber = `OTR-${new Date().getFullYear()}-${String(
      (deliveryCount || 0) + 1
    ).padStart(4, "0")}`;

    // Create delivery note
    const { data: deliveryNote, error: dnError } = await supabaseClient
      .from("delivery_notes")
      .insert({
        work_order_id: workOrderId,
        delivery_number: deliveryNumber,
        client_name: workOrder.client.name,
        client_pib: workOrder.client.pib,
        opened_at: workOrder.created_at,
        closed_at: workOrder.closed_at || new Date().toISOString(),
        items: fileEntries.map((fe) => ({
          filename: fe.filename,
          quantity: fe.quantity,
          file_type: fe.file_type,
        })),
        sent_to_email: workOrder.client.notification_email,
      })
      .select()
      .single();

    if (dnError || !deliveryNote) {
      console.error("Error creating delivery note:", dnError);
      throw new Error("Error creating delivery note");
    }

    // Send email if notification email exists
    if (workOrder.client.notification_email) {
      const emailContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f4f4f4; font-weight: bold; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Otpremnica - ${deliveryNumber}</h2>
              </div>
              <div class="content">
                <p><strong>Klijent:</strong> ${workOrder.client.name}</p>
                ${workOrder.client.pib ? `<p><strong>PIB:</strong> ${workOrder.client.pib}</p>` : ''}
                <p><strong>Radni nalog:</strong> ${workOrder.order_number}</p>
                <p><strong>Datum otvaranja:</strong> ${new Date(
                  workOrder.created_at
                ).toLocaleDateString("sr-RS")}</p>
                <p><strong>Datum zatvaranja:</strong> ${new Date(
                  deliveryNote.closed_at
                ).toLocaleDateString("sr-RS")}</p>
                
                <h3>Stavke:</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Naziv fajla</th>
                      <th>Količina</th>
                      <th>Tip</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${fileEntries
                      .map(
                        (fe) => `
                      <tr>
                        <td>${fe.filename}</td>
                        <td>${fe.quantity || "-"}</td>
                        <td>${fe.file_type}</td>
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
              <div class="footer">
                <p>Ova poruka je automatski generisana iz sistema za upravljanje radnim nalozima.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const emailResponse = await resend.emails.send({
        from: "Gama United <obavestenje@gamaunited.rs>",
        to: [workOrder.client.notification_email],
        subject: `Otpremnica ${deliveryNumber} - ${workOrder.order_number}`,
        html: emailContent,
      });

      console.log("Email sent:", emailResponse);

      // Update delivery note with sent timestamp
      await supabaseClient
        .from("delivery_notes")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", deliveryNote.id);

      // Log email
      await supabaseClient.from("email_log").insert({
        work_order_id: workOrderId,
        recipient_email: workOrder.client.notification_email,
        subject: `Otpremnica ${deliveryNumber}`,
        status: "sent",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        deliveryNote,
        emailSent: !!workOrder.client.notification_email,
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
