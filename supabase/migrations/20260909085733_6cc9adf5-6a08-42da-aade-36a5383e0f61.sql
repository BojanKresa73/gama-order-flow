CREATE INDEX IF NOT EXISTS idx_email_jobs_wo_created ON public.email_jobs (work_order_id, created_at DESC);
ANALYZE public.email_jobs;