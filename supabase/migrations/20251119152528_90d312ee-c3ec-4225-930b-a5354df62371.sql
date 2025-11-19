-- Create email_outbox table for failed email retries
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL DEFAULT 'delivery_note', -- 'delivery_note', 'archive', etc.
  recipient_emails TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  pdf_bucket TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  try_count INTEGER NOT NULL DEFAULT 0,
  max_tries INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cron job queries
CREATE INDEX idx_email_outbox_pending ON public.email_outbox(next_retry_at, sent_at) 
WHERE sent_at IS NULL AND try_count < max_tries;

-- RLS policies
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email outbox"
  ON public.email_outbox FOR SELECT
  USING (public.has_any_role(ARRAY['admin', 'superuser']::app_role[]));

CREATE POLICY "System can manage email outbox"
  ON public.email_outbox FOR ALL
  USING (true)
  WITH CHECK (true);