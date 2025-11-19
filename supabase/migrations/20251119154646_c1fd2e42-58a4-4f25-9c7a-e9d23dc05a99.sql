-- Add across and rows columns to film_jobs table for detailed cutting calculation
ALTER TABLE public.film_jobs
ADD COLUMN IF NOT EXISTS across_count integer,
ADD COLUMN IF NOT EXISTS rows_needed integer;

COMMENT ON COLUMN public.film_jobs.across_count IS 'Number of pieces that fit across the roll width';
COMMENT ON COLUMN public.film_jobs.rows_needed IS 'Number of rows (passes) needed for the quantity';