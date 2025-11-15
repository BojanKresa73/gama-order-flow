-- Ponovo kreiram view kao SECURITY INVOKER (koristi permisije pozivača, ne kreatora)
create or replace view public.v_plate_usage_monthly
with (security_invoker = true)
as
select
  date_trunc('month', usage_date)::date as month,
  client_id,
  plate_format,
  sum(plates_used) as plates_used
from public.plate_usage_stats
group by 1, 2, 3;

comment on view public.v_plate_usage_monthly is 'Mesečni agregati potrošnje ploča grupisani po klijentu i formatu';