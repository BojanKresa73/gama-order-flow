import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendDeliveryNoteEmail, retryWithBackoff } from "../_shared/email-helpers.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (_req) => {
  try {
    console.log('[drain-email-outbox] Starting email outbox drain...');
    
    const supabase = createClient(supabaseUrl, serviceKey);
    
    // Fetch pending emails (not sent, try_count < max_tries, and retry time passed)
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_outbox')
      .select('*')
      .is('sent_at', null)
      .lte('next_retry_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (fetchError) {
      console.error('[drain-email-outbox] Error fetching emails:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }
    
    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('[drain-email-outbox] No pending emails to process');
      return new Response(JSON.stringify({ message: 'No pending emails', processed: 0 }), { status: 200 });
    }
    
    console.log(`[drain-email-outbox] Found ${pendingEmails.length} pending emails`);
    
    let successCount = 0;
    let failCount = 0;
    
      for (const email of pendingEmails) {
      // Filter in memory: only process if try_count < max_tries
      if (email.try_count >= email.max_tries) {
        console.log(`[drain-email-outbox] Skipping email ${email.id} - max retries reached`);
        continue;
      }
      
      try {
        console.log(`[drain-email-outbox] Processing email ${email.id} (attempt ${email.try_count + 1}/${email.max_tries})...`);
        
        // Try to send email with retry
        await retryWithBackoff(async () => {
          await sendDeliveryNoteEmail({
            subject: email.subject,
            to: email.recipient_emails,
            pdfBucket: email.pdf_bucket,
            pdfPath: email.pdf_path,
            sbUrl: supabaseUrl,
            serviceKey: serviceKey,
          });
        }, 2, 1000);
        
        // Mark as sent
        await supabase
          .from('email_outbox')
          .update({ 
            sent_at: new Date().toISOString(),
            last_error: null
          })
          .eq('id', email.id);
        
        console.log(`[drain-email-outbox] Email ${email.id} sent successfully`);
        successCount++;
        
        // Log success to email_log
        await supabase.from('email_log').insert({
          work_order_id: email.work_order_id,
          recipient_email: email.recipient_emails.join(', '),
          subject: email.subject,
          status: 'sent',
          type: email.email_type,
        });
        
      } catch (error: any) {
        console.error(`[drain-email-outbox] Failed to send email ${email.id}:`, error);
        
        const newTryCount = email.try_count + 1;
        const isMaxReached = newTryCount >= email.max_tries;
        
        // Calculate next retry time with exponential backoff (5min, 10min, 20min, 40min)
        const nextRetryDelay = Math.min(5 * Math.pow(2, newTryCount), 60); // max 60 minutes
        const nextRetryAt = new Date(Date.now() + nextRetryDelay * 60 * 1000);
        
        // Update try count and error
        await supabase
          .from('email_outbox')
          .update({
            try_count: newTryCount,
            last_error: error.message || String(error),
            next_retry_at: isMaxReached ? null : nextRetryAt.toISOString(),
          })
          .eq('id', email.id);
        
        failCount++;
        
        // Log failure to email_log
        await supabase.from('email_log').insert({
          work_order_id: email.work_order_id,
          recipient_email: email.recipient_emails.join(', '),
          subject: email.subject,
          status: isMaxReached ? 'failed_permanent' : 'failed_retry',
          error_message: error.message || String(error),
          type: email.email_type,
        });
      }
    }
    
    console.log(`[drain-email-outbox] Completed: ${successCount} sent, ${failCount} failed`);
    
    return new Response(
      JSON.stringify({ 
        message: 'Email outbox drained',
        processed: pendingEmails.length,
        success: successCount,
        failed: failCount
      }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('[drain-email-outbox] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
