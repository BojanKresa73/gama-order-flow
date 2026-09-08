ALTER TABLE public.newsletter_sends ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_campaign_status ON public.newsletter_sends (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_recipient ON public.newsletter_sends (recipient_id);