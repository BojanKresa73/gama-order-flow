-- 1. Create sequences per work order type (separate counters)
create sequence if not exists seq_workorder_ctp        increment by 1 minvalue 1;
create sequence if not exists seq_workorder_digitala   increment by 1 minvalue 1;
create sequence if not exists seq_workorder_filmovanje increment by 1 minvalue 1;
create sequence if not exists seq_workorder_razno      increment by 1 minvalue 1;

-- 2. Add display_order_number column
alter table public.work_orders
  add column if not exists display_order_number text;

-- 3. Create trigger function to populate display_order_number
create or replace function public.fn_set_display_order_number()
returns trigger 
language plpgsql
set search_path = public
as $$
declare
  n bigint;
  pref text;
begin
  if new.display_order_number is not null then
    return new;
  end if;

  case new.kind
    when 'CTP'         then n := nextval('seq_workorder_ctp');        pref := 'CTP';
    when 'DIGITALA'    then n := nextval('seq_workorder_digitala');   pref := 'DIG';
    when 'FILMOVANJE'  then n := nextval('seq_workorder_filmovanje'); pref := 'FILM';
    when 'RAZNO'       then n := nextval('seq_workorder_razno');      pref := 'RZN';
  end case;

  new.display_order_number :=
    pref || '-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(n::text, 6, '0');

  return new;
end$$;

-- 4. Create trigger
drop trigger if exists trg_set_display_order_number on public.work_orders;
create trigger trg_set_display_order_number
before insert on public.work_orders
for each row execute function public.fn_set_display_order_number();