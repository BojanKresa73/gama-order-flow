-- Funkcija za refresh dnevnih agregata iz inventory_history
create or replace function public.refresh_plate_usage_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Briši postojeće agregate
  truncate table public.plate_usage_stats;

  -- Kreiraj nove agregate iz inventory_history
  insert into public.plate_usage_stats (usage_date, client_id, plate_format, plates_used)
  select
    date(ih.created_at) as usage_date,
    wo.client_id,
    pf.format_name as plate_format,
    sum(abs(ih.change_amount))::int as plates_used
  from public.inventory_history ih
  inner join public.plate_formats pf on pf.id = ih.plate_format_id
  left join public.work_orders wo on wo.id = ih.work_order_id
  where ih.change_amount < 0  -- samo potrošnja (negativne promene)
  group by 1, 2, 3
  on conflict (usage_date, client_id, plate_format) 
  do update set 
    plates_used = excluded.plates_used,
    created_at = now();
end;
$$;

comment on function public.refresh_plate_usage_stats is 'Rebuild plate_usage_stats tabele iz inventory_history (samo potrošnja)';