-- Add indexes for better performance when fetching work order items
CREATE INDEX IF NOT EXISTS idx_film_jobs_work_order ON public.film_jobs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_digital_jobs_work_order ON public.digital_jobs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_file_entries_work_order ON public.file_entries(work_order_id);