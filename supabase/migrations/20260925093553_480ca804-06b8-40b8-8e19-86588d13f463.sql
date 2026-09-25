CREATE INDEX IF NOT EXISTS idx_email_jobs_work_order_created ON public.email_jobs (work_order_id, created_at DESC);

ANALYZE public.email_jobs;
ANALYZE public.work_orders;
ANALYZE public.file_entries;

DROP POLICY IF EXISTS "Superusers can read ctp_monthly_report_log" ON public.ctp_monthly_report_log;
DROP POLICY IF EXISTS "Admins can read ctp_monthly_report_log" ON public.ctp_monthly_report_log;
CREATE POLICY "Admins can read ctp_monthly_report_log"
ON public.ctp_monthly_report_log
FOR SELECT TO authenticated
USING (public.has_admin_plus_access(auth.uid()));