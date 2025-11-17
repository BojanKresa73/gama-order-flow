-- Modify plate_usage_stats table structure
-- Change client_id from uuid NOT NULL to text NULL

-- Step 1: Drop the dependent view
drop view if exists public.v_plate_usage_monthly;

-- Step 2: Drop the primary key constraint
alter table public.plate_usage_stats drop constraint plate_usage_stats_pkey;

-- Step 3: Alter the client_id column type and nullability
alter table public.plate_usage_stats 
  alter column client_id type text using client_id::text,
  alter column client_id drop not null;

-- Step 4: Recreate the primary key
alter table public.plate_usage_stats 
  add primary key (usage_date, client_id, plate_format);

-- Step 5: Recreate the view with the new schema
create or replace view public.v_plate_usage_monthly as
select
  date_trunc('month', usage_date)::date as month,
  client_id,
  plate_format,
  sum(plates_used) as plates_used
from public.plate_usage_stats
group by 1, 2, 3;

-- Step 6: Update the refresh function to handle the new schema
create or replace function public.refresh_plate_usage_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete existing aggregates
  truncate table public.plate_usage_stats;

  -- Create new aggregates from inventory_history
  insert into public.plate_usage_stats (usage_date, client_id, plate_format, plates_used)
  select
    date(ih.created_at) as usage_date,
    wo.client_id::text,
    pf.format_name as plate_format,
    sum(abs(ih.change_amount))::int as plates_used
  from public.inventory_history ih
  inner join public.plate_formats pf on pf.id = ih.plate_format_id
  left join public.work_orders wo on wo.id = ih.work_order_id
  where ih.change_amount < 0  -- only consumption (negative changes)
  group by 1, 2, 3
  on conflict (usage_date, client_id, plate_format) 
  do update set 
    plates_used = excluded.plates_used,
    created_at = now();
end;
$$;