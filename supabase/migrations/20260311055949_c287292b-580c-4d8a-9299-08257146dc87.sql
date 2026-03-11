
ALTER TABLE public.newsletter_recipients 
ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_recipients_unsub_token 
ON public.newsletter_recipients(unsubscribe_token);
