-- Add new fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS pib text,
ADD COLUMN IF NOT EXISTS maticni_broj text,
ADD COLUMN IF NOT EXISTS adresa text,
ADD COLUMN IF NOT EXISTS grad text,
ADD COLUMN IF NOT EXISTS postanski_broj text,
ADD COLUMN IF NOT EXISTS drzava text DEFAULT 'Srbija',
ADD COLUMN IF NOT EXISTS kontakt_osoba text,
ADD COLUMN IF NOT EXISTS telefon text,
ADD COLUMN IF NOT EXISTS rok_placanja_dana integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rabat_procenat numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS napomena text;

-- Create unique index on pib (nullable, so only non-null values must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_pib ON public.clients(pib) WHERE pib IS NOT NULL;

-- Create regular index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_pib_lookup ON public.clients(pib);

-- Add check constraint for rabat_procenat (0-100)
ALTER TABLE public.clients 
ADD CONSTRAINT check_rabat_procenat CHECK (rabat_procenat >= 0 AND rabat_procenat <= 100);

-- Add check constraint for rok_placanja_dana (0-120)
ALTER TABLE public.clients 
ADD CONSTRAINT check_rok_placanja CHECK (rok_placanja_dana >= 0 AND rok_placanja_dana <= 120);