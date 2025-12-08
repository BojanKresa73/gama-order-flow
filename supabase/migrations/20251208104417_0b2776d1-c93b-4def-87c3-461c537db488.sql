-- Fix email_jobs table RLS - restrict to admins/superusers only
DROP POLICY IF EXISTS "Authenticated users can view email jobs" ON public.email_jobs;

CREATE POLICY "Admins and superusers can view email jobs"
ON public.email_jobs
FOR SELECT
USING (
  has_role(auth.uid(), 'superuser'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix email_log table RLS - restrict to admins/superusers only
DROP POLICY IF EXISTS "Authenticated users can view email log" ON public.email_log;

CREATE POLICY "Admins and superusers can view email log"
ON public.email_log
FOR SELECT
USING (
  has_role(auth.uid(), 'superuser'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);