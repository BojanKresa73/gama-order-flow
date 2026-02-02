-- Rename price_rsd to price_eur in client_plate_prices
ALTER TABLE public.client_plate_prices 
RENAME COLUMN price_rsd TO price_eur;

-- Add comment for clarity
COMMENT ON COLUMN public.client_plate_prices.price_eur IS 'Cena ploče u EUR';