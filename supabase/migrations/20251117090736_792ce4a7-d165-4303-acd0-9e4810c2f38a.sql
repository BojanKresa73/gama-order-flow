-- Set the view to use security invoker (runs with caller's privileges)
-- This ensures the view respects RLS policies from the underlying email_jobs table
alter view public.email_job_latest_status set (security_invoker = true);