-- View za mesečne agregate potrošnje ploča
create or replace view public.v_plate_usage_monthly as
select
  date_trunc('month', usage_date)::date as month,
  client_id,
  plate_format,
  sum(plates_used) as plates_used
from public.plate_usage_stats
group by 1, 2, 3;

-- Komentar za dokumentaciju
comment on view public.v_plate_usage_monthly is 'Mesečni agregati potrošnje ploča grupisani po klijentu i formatu';