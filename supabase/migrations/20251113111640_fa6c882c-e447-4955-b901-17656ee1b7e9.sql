-- Add override price field to work_orders
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS film_price_override_eur_per_m numeric;

COMMENT ON COLUMN work_orders.film_price_override_eur_per_m IS 'Override selling price per meter for film jobs, if specified uses this instead of default from film_settings';