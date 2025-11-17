-- 1) Create enum type for work order type if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wo_type') THEN
    CREATE TYPE wo_type AS ENUM ('CTP','DIGITAL','FILM','OSTALO');
  END IF;
END$$;

-- 2) Add type column to work_orders if it doesn't exist
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS type wo_type;

-- 3) Backfill existing rows - set to CTP for NULL values
UPDATE public.work_orders
SET type = 'CTP'
WHERE type IS NULL;

-- 4) Make column NOT NULL with default value
ALTER TABLE public.work_orders
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN type SET DEFAULT 'CTP';