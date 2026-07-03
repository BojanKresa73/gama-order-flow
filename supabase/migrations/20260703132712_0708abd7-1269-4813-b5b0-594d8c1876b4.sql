
-- Slobodne (pasted) ponude — dodaj polja i poseban brojač PON-M-YYYY-NNNN
ALTER TABLE public.quick_calc_quotes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'calc',
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS client_pib TEXT,
  ADD COLUMN IF NOT EXISTS client_address TEXT,
  ADD COLUMN IF NOT EXISTS signer_job_title TEXT;

-- Total sme biti NULL kod slobodnih ponuda bez iznosa
ALTER TABLE public.quick_calc_quotes ALTER COLUMN total_eur DROP NOT NULL;
ALTER TABLE public.quick_calc_quotes ALTER COLUMN total_eur DROP DEFAULT;

-- Poseban brojač za "manuelne / pasted" ponude
CREATE TABLE IF NOT EXISTS public.quick_calc_pasted_counters (
  year INTEGER PRIMARY KEY,
  last_serial INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE ON public.quick_calc_pasted_counters TO authenticated;
GRANT ALL ON public.quick_calc_pasted_counters TO service_role;
ALTER TABLE public.quick_calc_pasted_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read pasted counters" ON public.quick_calc_pasted_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write pasted counters" ON public.quick_calc_pasted_counters FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_pasted_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::int;
  v_serial INT;
BEGIN
  INSERT INTO public.quick_calc_pasted_counters (year, last_serial)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_serial = quick_calc_pasted_counters.last_serial + 1
  RETURNING last_serial INTO v_serial;
  RETURN 'PON-M-' || v_year || '-' || LPAD(v_serial::text, 4, '0');
END;
$$;
