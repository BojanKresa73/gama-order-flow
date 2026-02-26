
-- Create newsletter drafts table
CREATE TABLE public.newsletter_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  theme_name TEXT NOT NULL DEFAULT 'Standard',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_drafts ENABLE ROW LEVEL SECURITY;

-- Only superuser can manage drafts
CREATE POLICY "Superuser can manage newsletter drafts"
ON public.newsletter_drafts
FOR ALL
USING (has_role(auth.uid(), 'superuser'::app_role))
WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_newsletter_drafts_updated_at
BEFORE UPDATE ON public.newsletter_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
