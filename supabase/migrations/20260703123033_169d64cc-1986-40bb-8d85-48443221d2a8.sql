
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;

CREATE TABLE IF NOT EXISTS public.quick_calc_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_company TEXT,
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  signer_name TEXT,
  signer_email TEXT,
  signer_phone TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_calc_quotes TO authenticated;
GRANT ALL ON public.quick_calc_quotes TO service_role;

ALTER TABLE public.quick_calc_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own quotes"
  ON public.quick_calc_quotes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all quotes"
  ON public.quick_calc_quotes FOR SELECT
  USING (public.has_admin_access(auth.uid()));

CREATE TRIGGER update_quick_calc_quotes_updated_at
  BEFORE UPDATE ON public.quick_calc_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_qcq_user_created ON public.quick_calc_quotes(user_id, created_at DESC);

-- Sequence for quote numbers per year
CREATE TABLE IF NOT EXISTS public.quick_calc_quote_counters (
  year INTEGER PRIMARY KEY,
  last_serial INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE ON public.quick_calc_quote_counters TO authenticated;
GRANT ALL ON public.quick_calc_quote_counters TO service_role;
ALTER TABLE public.quick_calc_quote_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read counters" ON public.quick_calc_quote_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write counters" ON public.quick_calc_quote_counters FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::int;
  v_serial INT;
BEGIN
  INSERT INTO public.quick_calc_quote_counters (year, last_serial)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_serial = quick_calc_quote_counters.last_serial + 1
  RETURNING last_serial INTO v_serial;
  RETURN 'PON-' || v_year || '-' || LPAD(v_serial::text, 4, '0');
END;
$$;
