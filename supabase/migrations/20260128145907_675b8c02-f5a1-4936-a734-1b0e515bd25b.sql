-- Add prep_hours column to work_orders table for digital order preparation time
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS prep_hours numeric DEFAULT 0;

COMMENT ON COLUMN public.work_orders.prep_hours IS 'Number of preparation hours for digital orders, charged at 25 EUR/hour';