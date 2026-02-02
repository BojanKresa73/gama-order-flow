-- Tabela za keširanje NBS kurseva
CREATE TABLE public.nbs_exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency_code TEXT NOT NULL,
  middle_rate NUMERIC(12,4) NOT NULL,
  list_number INTEGER,
  list_date DATE NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'nbs_soap'
);

-- Index za brzo pretraživanje
CREATE INDEX idx_nbs_rates_currency_valid ON public.nbs_exchange_rates (currency_code, valid_from DESC);

-- Unique constraint - jedan kurs po valuti po danu
CREATE UNIQUE INDEX idx_nbs_rates_unique ON public.nbs_exchange_rates (currency_code, list_date);

-- RLS - samo čitanje za authenticated korisnike
ALTER TABLE public.nbs_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users"
  ON public.nbs_exchange_rates
  FOR SELECT
  USING (true);

-- Funkcija za dobijanje trenutno važećeg kursa
CREATE OR REPLACE FUNCTION public.get_current_nbs_rate(p_currency TEXT DEFAULT 'EUR')
RETURNS NUMERIC(12,4)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate NUMERIC(12,4);
BEGIN
  -- Nađi kurs koji važi za trenutni momenat
  SELECT middle_rate INTO v_rate
  FROM nbs_exchange_rates
  WHERE currency_code = p_currency
    AND now() >= valid_from
    AND now() < valid_to
  ORDER BY valid_from DESC
  LIMIT 1;
  
  -- Ako nema važećeg, uzmi poslednji poznati
  IF v_rate IS NULL THEN
    SELECT middle_rate INTO v_rate
    FROM nbs_exchange_rates
    WHERE currency_code = p_currency
    ORDER BY list_date DESC
    LIMIT 1;
  END IF;
  
  RETURN v_rate;
END;
$$;