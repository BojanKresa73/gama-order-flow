import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@3.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const FROM = "Gama United <noreply@gamaunited.rs>";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting email job processing...");

  try {
    // 1) Fetch up to 20 pending jobs
    const { data: jobs, error } = await supabase
      .from("email_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error("Error fetching jobs:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!jobs?.length) {
      console.log("No pending jobs found");
      return new Response(JSON.stringify({ message: "No pending jobs", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${jobs.length} pending jobs`);

    let successCount = 0;
    let errorCount = 0;

    // 2) Process each job
    for (const job of jobs) {
      try {
        console.log(`Sending email to ${job.client_email} for job ${job.id}`);

        // Send email via Resend
        const emailResult = await resend.emails.send({
          from: FROM,
          to: job.client_email,
          subject: job.subject,
          html: job.html_body,
        });

        console.log(`Email sent successfully for job ${job.id}:`, emailResult);

        // 3) Mark as sent
        const { error: updateError } = await supabase
          .from("email_jobs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error_msg: null
          })
          .eq("id", job.id);

        if (updateError) {
          console.error(`Error updating job ${job.id}:`, updateError);
        } else {
          successCount++;
        }
      } catch (e) {
        console.error(`Error processing job ${job.id}:`, e);
        errorCount++;

        // Mark as error
        await supabase
          .from("email_jobs")
          .update({
            status: "error",
            error_msg: String(e)
          })
          .eq("id", job.id);
      }
    }

    console.log(`Processing complete: ${successCount} sent, ${errorCount} errors`);

    return new Response(JSON.stringify({
      message: "Processing complete",
      total: jobs.length,
      success: successCount,
      errors: errorCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
