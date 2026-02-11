
ALTER TABLE public.ctp_job_timing_log 
ADD COLUMN IF NOT EXISTS reception_operator text,
ADD COLUMN IF NOT EXISTS plate_operator text;
