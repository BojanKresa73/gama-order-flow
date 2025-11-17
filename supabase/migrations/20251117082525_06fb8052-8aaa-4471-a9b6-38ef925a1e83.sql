-- 1. Create ENUM type for work_order_kind
do $$
begin
  if not exists (select 1 from pg_type where typname = 'work_order_kind') then
    create type public.work_order_kind as enum ('CTP','DIGITALA','FILMOVANJE','RAZNO');
  end if;
end$$;

-- 2. Add kind column to work_orders
alter table public.work_orders
  add column if not exists kind public.work_order_kind
  not null default 'DIGITALA';

-- 3. Create index for filtering/listing
create index if not exists idx_work_orders_kind_status_created
  on public.work_orders(kind, status, created_at);

-- 4. Create views by kind (optional but useful for UI/queries)
create or replace view public.work_orders_ctp 
with (security_invoker = true)
as select * from public.work_orders where kind='CTP';

create or replace view public.work_orders_digitala
with (security_invoker = true)
as select * from public.work_orders where kind='DIGITALA';

create or replace view public.work_orders_filmovanje
with (security_invoker = true)
as select * from public.work_orders where kind='FILMOVANJE';

create or replace view public.work_orders_razno
with (security_invoker = true)
as select * from public.work_orders where kind='RAZNO';