import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendMail } from "../_shared/email-provider.ts";

const STATUS_LABELS: Record<string, string> = {
  new: "Nova",
  in_review: "U pregledu",
  in_progress: "U rešavanju",
  resolved: "Rešena",
  rejected: "Odbijena",
};

const CATEGORY_LABELS: Record<string, string> = {
  job: "Konkretan posao / nalog",
  quality: "Kvalitet rada",
  employee: "Odnos zaposlenog",
  deadline: "Rok isporuke",
  other: "Ostalo",
};

function wrap(title: string, rows: string[], body: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937">
    <h2 style="margin:0 0 12px">${title}</h2>
    <table style="border-collapse:collapse;margin-bottom:16px">
      ${rows.map((r) => `<tr><td style="padding:2px 0">${r}</td></tr>`).join("")}
    </table>
    <div style="white-space:pre-wrap;background:#f3f4f6;padding:12px;border-radius:8px">${body}</div>
    <p style="margin-top:16px;color:#6b7280;font-size:12px">Gama United — sistem reklamacija</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { complaint_id, event, note } = await req.json();
    if (!complaint_id || typeof complaint_id !== "string") {
      return new Response(JSON.stringify({ error: "complaint_id je obavezan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Require an authenticated caller
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Neautorizovano" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: complaint, error } = await admin
      .from("complaints")
      .select("*, clients(name, notification_email, notification_email_2, notification_email_3)")
      .eq("id", complaint_id)
      .single();
    if (error || !complaint) throw new Error("Reklamacija nije nađena");

    const clientName = (complaint as any).clients?.name || "Klijent";
    const rows = [
      `<strong>Broj:</strong> ${complaint.complaint_number}`,
      `<strong>Klijent:</strong> ${clientName}`,
      `<strong>Tip:</strong> ${CATEGORY_LABELS[complaint.category] || complaint.category}`,
      `<strong>Ozbiljnost:</strong> ${complaint.severity}/5`,
      `<strong>Status:</strong> ${STATUS_LABELS[complaint.status] || complaint.status}`,
      `<strong>Rok za odgovor:</strong> ${new Date(complaint.due_at).toLocaleString("sr-RS")}`,
    ];

    if (event === "created") {
      // Notify superusers only
      const { data: roles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "superuser");

      const emails: string[] = [];
      for (const r of roles || []) {
        const { data } = await admin.auth.admin.getUserById(r.user_id);
        if (data?.user?.email) emails.push(data.user.email);
      }

      if (emails.length > 0) {
        await sendMail({
          to: emails,
          subject: `Nova reklamacija ${complaint.complaint_number} — ${clientName}`,
          html: wrap(
            `Nova reklamacija: ${complaint.subject}`,
            rows,
            complaint.description
          ),
        });
      }
    } else {
      // Notify the client (portal + email)
      const c = (complaint as any).clients || {};
      const clientEmails = [c.notification_email, c.notification_email_2, c.notification_email_3]
        .filter((e: string | null) => !!e);

      const title =
        event === "status_changed"
          ? `Reklamacija ${complaint.complaint_number}: ${STATUS_LABELS[complaint.status] || complaint.status}`
          : `Novi odgovor na reklamaciju ${complaint.complaint_number}`;

      if (clientEmails.length > 0) {
        await sendMail({
          to: clientEmails,
          subject: title,
          html: wrap(title, rows, note || complaint.resolution_note || complaint.subject),
        });
      }

      if (complaint.work_order_id) {
        await admin.from("portal_notifications").insert({
          client_id: complaint.client_id,
          work_order_id: complaint.work_order_id,
          title,
          message: note || complaint.subject,
          event_type: "complaint_update",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-complaint error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
