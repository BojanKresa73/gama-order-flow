-- Create view for latest email job status per work order
create or replace view public.email_job_latest_status as
select distinct on (work_order_id)
  work_order_id,
  status,
  sent_at,
  created_at,
  error_msg
from public.email_jobs
order by work_order_id, created_at desc;