ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS target_price_eur NUMERIC,
  ADD COLUMN IF NOT EXISTS sent_snapshot JSONB;