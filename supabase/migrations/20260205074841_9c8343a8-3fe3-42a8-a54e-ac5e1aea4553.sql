-- Add mono pricing toggle to clients table
ALTER TABLE public.clients
ADD COLUMN has_mono_pricing boolean NOT NULL DEFAULT false;

-- Add mono price column to client_plate_prices
ALTER TABLE public.client_plate_prices
ADD COLUMN price_eur_mono numeric;

-- Add comment for clarity
COMMENT ON COLUMN public.clients.has_mono_pricing IS 'If true, this client has special pricing for mono jobs (1 plate per file)';
COMMENT ON COLUMN public.client_plate_prices.price_eur_mono IS 'Price per plate for mono jobs (files with exactly 1 plate). Only applicable when client.has_mono_pricing is true.';