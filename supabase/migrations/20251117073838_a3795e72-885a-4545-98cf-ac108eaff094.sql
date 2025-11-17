-- Ensure v_plate_usage_monthly view is secure
-- Explicitly set SECURITY INVOKER to fix the security linter warning

drop view if exists public.v_plate_usage_monthly;

create view public.v_plate_usage_monthly
with (security_invoker = true)
as
select
  date_trunc('month', usage_date)::date as month,
  client_id,
  plate_format,
  sum(plates_used) as plates_used
from public.plate_usage_stats
group by 1, 2, 3;