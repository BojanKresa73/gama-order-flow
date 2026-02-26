
-- Newsletter recipients (imported from Excel or manually added)
CREATE TABLE public.newsletter_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  email text NOT NULL,
  contact_person text,
  city text,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_newsletter_recipients_email ON public.newsletter_recipients(email);

ALTER TABLE public.newsletter_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only superuser can manage newsletter recipients"
  ON public.newsletter_recipients FOR ALL
  USING (has_role(auth.uid(), 'superuser'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- Newsletter campaigns
CREATE TABLE public.newsletter_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  html_body text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, sending, sent
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only superuser can manage newsletter campaigns"
  ON public.newsletter_campaigns FOR ALL
  USING (has_role(auth.uid(), 'superuser'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- Individual send records for tracking
CREATE TABLE public.newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.newsletter_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.newsletter_recipients(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed
  error_msg text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only superuser can manage newsletter sends"
  ON public.newsletter_sends FOR ALL
  USING (has_role(auth.uid(), 'superuser'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_newsletter_recipients_updated_at
  BEFORE UPDATE ON public.newsletter_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_newsletter_campaigns_updated_at
  BEFORE UPDATE ON public.newsletter_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
