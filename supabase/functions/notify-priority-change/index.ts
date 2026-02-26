import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  logId: string;
  workOrderId: string;
  orderNumber: string;
  oldPriority: number;
  newPriority: number;
  clientName: string;
  changedByName: string;
  note?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@gamaunited.rs";

    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      logId,
      workOrderId,
      orderNumber,
      oldPriority,
      newPriority,
      clientName,
      changedByName,
      note,
    }: NotifyRequest = await req.json();

    console.log(`[notify-priority-change] Processing priority change for order ${orderNumber}`);

    // Get client notification email
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        client_id,
        clients!inner(notification_email, notification_email_2, name)
      `)
      .eq("id", workOrderId)
      .single();

    if (woError) {
      console.error("Error fetching work order:", woError);
      throw woError;
    }

    const client = workOrder.clients as any;
    const recipientEmails: string[] = [];

    // Add internal email
    recipientEmails.push("ctp@gamaunited.rs");

    // Add client notification emails if available
    if (client.notification_email) {
      recipientEmails.push(client.notification_email);
    }
    if (client.notification_email_2) {
      recipientEmails.push(client.notification_email_2);
    }

    // Build email content
    const priorityDirection = newPriority > oldPriority ? "povećan" : "smanjen";
    const priorityEmoji = newPriority >= 8 ? "🔴" : newPriority >= 5 ? "🟡" : "🟢";

    const subject = `${priorityEmoji} Prioritet ${priorityDirection}: ${orderNumber} (${oldPriority} → ${newPriority})`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Promena prioriteta naloga</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Nalog:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Klijent:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${clientName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Stari prioritet:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${oldPriority}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Novi prioritet:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: ${newPriority >= 8 ? '#dc2626' : newPriority >= 5 ? '#ca8a04' : '#16a34a'};">${newPriority}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Promenio:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${changedByName}</td>
          </tr>
          ${note ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Napomena:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${note}</td>
          </tr>
          ` : ''}
        </table>
        
        <p style="color: #666; font-size: 14px;">
          Prioritet: 1 (najmanji) - 10 (najhitniji)
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">
          Gama United - Sistem za upravljanje nalozima
        </p>
      </div>
    `;

    // Send email if Resend is configured
    if (resendApiKey) {
      for (const email of recipientEmails) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject,
              html: htmlBody,
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.error(`[notify-priority-change] Failed to send email to ${email}:`, errorData);
          } else {
            console.log(`[notify-priority-change] Email sent to ${email}`);
          }
        } catch (emailError) {
          console.error(`[notify-priority-change] Failed to send email to ${email}:`, emailError);
        }
      }
    } else {
      console.log("[notify-priority-change] RESEND_API_KEY not configured, skipping email");
    }

    // Also create portal notification for priority change
    try {
      await supabase.from('portal_notifications').insert({
        client_id: workOrder.client_id,
        work_order_id: workOrderId,
        event_type: 'priority_changed',
        title: `Prioritet promenjen: ${orderNumber}`,
        message: `Prioritet ${priorityDirection} sa ${oldPriority} na ${newPriority}. ${note ? 'Napomena: ' + note : ''}`.trim(),
      });
    } catch (portalErr) {
      console.error('[notify-priority-change] Portal notification failed:', portalErr);
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent: recipientEmails.length }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[notify-priority-change] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
