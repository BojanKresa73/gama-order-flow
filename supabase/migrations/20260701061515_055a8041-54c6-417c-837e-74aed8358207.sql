
-- Versionirane cene filmovanja (istorija poskupljenja)
CREATE TABLE IF NOT EXISTS public.film_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_eur_per_m numeric NOT NULL,
  price_eur_per_m numeric NOT NULL,
  valid_from date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.film_price_versions TO authenticated;
GRANT ALL ON public.film_price_versions TO service_role;

ALTER TABLE public.film_price_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view film price versions"
  ON public.film_price_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only superuser can manage film price versions"
  ON public.film_price_versions FOR ALL
  USING (has_role(auth.uid(), 'superuser'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superuser'::app_role));

-- Seed istorije: stare cene (od početka) i nove cene (od danas)
INSERT INTO public.film_price_versions (cost_eur_per_m, price_eur_per_m, valid_from, note)
VALUES 
  (15.0, 22.0, '2025-01-01', 'Početne cene (do 30.06.2026)'),
  (19.2, 26.0, CURRENT_DATE, 'Poskupljenje 01.07.2026 - nove ulazne/izlazne cene');

-- Ažuriraj tekuće film_settings na nove cene
UPDATE public.film_settings SET cost_eur_per_m = 19.2, price_eur_per_m = 26.0;

-- Helper: cena filma važeća za dati datum
CREATE OR REPLACE FUNCTION public.get_film_price_for_date(p_date date)
RETURNS TABLE(cost_eur_per_m numeric, price_eur_per_m numeric, valid_from date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cost_eur_per_m, price_eur_per_m, valid_from
  FROM public.film_price_versions
  WHERE valid_from <= p_date
  ORDER BY valid_from DESC
  LIMIT 1;
$$;
