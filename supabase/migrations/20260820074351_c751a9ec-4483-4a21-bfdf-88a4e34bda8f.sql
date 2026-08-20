CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_file_entries_filename_trgm ON public.file_entries USING gin (filename gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_film_jobs_file_name_trgm ON public.film_jobs USING gin (file_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_digital_jobs_file_name_trgm ON public.digital_jobs USING gin (file_name gin_trgm_ops);