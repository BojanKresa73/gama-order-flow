create table public.mm_bank_statements (
  id uuid primary key default gen_random_uuid(),
  account_code text not null,
  bank_name text,
  account_number text,
  statement_number text,
  statement_date date not null,
  closing_balance numeric,
  note text,
  entered_by uuid not null default auth.uid(),
  entered_at timestamptz not null default now()
);
grant select, insert, update, delete on public.mm_bank_statements to authenticated;
grant all on public.mm_bank_statements to service_role;
alter table public.mm_bank_statements enable row level security;
create policy "finance read" on public.mm_bank_statements for select to authenticated using (public.has_finance_access());
create policy "finance insert" on public.mm_bank_statements for insert to authenticated with check (public.has_finance_access() and entered_by = auth.uid());
create policy "finance delete" on public.mm_bank_statements for delete to authenticated using (public.has_finance_access());

create or replace function public.mm_books_freshness()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.has_finance_access() then raise exception 'Nemate pristup'; end if;
  with acc as (select distinct on (code) code, name from mm_accounts order by code),
  l as (select * from mm_ledger_clean()),
  banks as (
    select l.account_code code, a.name, (a.name ilike '%prelaz%' or a.name ilike '%pralaz%') transit, (a.name ilike '%deviz%') foreign_ccy,
      round(sum(debit_rsd-credit_rsd),2) booked_balance,
      max(entry_date) filter (where journal_type<>'OTV') last_booked,
      max(entry_date) filter (where journal_type='BD') last_statement_booked,
      round(coalesce(sum(debit_rsd-credit_rsd) filter (where journal_type='OTV'),0),2) opening
    from l join acc a on a.code=l.account_code where l.account_code ~ '^24' group by 1,2),
  st as (select distinct on (account_code) * from mm_bank_statements order by account_code, statement_date desc, entered_at desc),
  ycheck as (
    select year, round(sum(debit_rsd),2) debit, round(sum(credit_rsd),2) credit, round(sum(debit_rsd-credit_rsd),2) diff from mm_ledger_rows group by 1),
  cross_j as (
    select journal_minimax_id, journal_type, min(entry_date) d1, max(entry_date) d2,
      round(sum(debit_rsd-credit_rsd) filter (where year=(select min(year) from mm_ledger_rows)),2) net_first
    from mm_ledger_rows group by 1,2 having count(distinct year)>1),
  jbal as (select count(*) n from (select journal_minimax_id from mm_ledger_rows group by 1 having abs(sum(debit_rsd-credit_rsd))>0.01) z)
  select jsonb_build_object(
    'today', (now() at time zone 'Europe/Belgrade')::date,
    'last_sync', (select max(updated_at) from mm_sync_state where status='done'),
    'sync_errors', (select count(*) from mm_sync_state where status<>'done'),
    'last_entry', (select max(entry_date) from mm_ledger_rows where journal_type<>'OTV'),
    'banks', (select coalesce(jsonb_agg(jsonb_build_object('code',b.code,'name',b.name,'transit',b.transit,'foreign',b.foreign_ccy,'opening',b.opening,
        'booked_balance',b.booked_balance,'last_booked',b.last_booked,'last_statement_booked',b.last_statement_booked,
        'statement', case when s.id is null then null else jsonb_build_object('date',s.statement_date,'number',s.statement_number,'bank',s.bank_name,'account_number',s.account_number,'balance',s.closing_balance,'entered_at',s.entered_at) end,
        'booked_at_statement_date', case when s.id is null then null else (select round(coalesce(sum(debit_rsd-credit_rsd),0),2) from l where l.account_code=b.code and l.entry_date<=s.statement_date) end
      ) order by b.transit, b.code),'[]') from banks b left join st s on s.account_code=b.code),
    'bank_totals', jsonb_build_object(
      'bank_only', (select round(sum(booked_balance),2) from banks where not transit),
      'konto_241', (select round(sum(booked_balance),2) from banks where code like '241%'),
      'all_24', (select round(sum(booked_balance),2) from banks)),
    'ledger_years', (select jsonb_agg(to_jsonb(y) order by year) from ycheck y),
    'ledger_total_diff', (select round(sum(debit_rsd-credit_rsd),2) from mm_ledger_rows),
    'unbalanced_journals', (select n from jbal),
    'cross_year', jsonb_build_object('count',(select count(*) from cross_j),
      'by_type',(select jsonb_agg(jsonb_build_object('type',journal_type,'count',c,'net_first_year',s)) from (select journal_type,count(*) c,sum(net_first) s from cross_j group by 1) z),
      'sample',(select jsonb_agg(to_jsonb(x)) from (select * from cross_j order by abs(net_first) desc limit 10) x))
  ) into r;
  return r;
end $$;
revoke all on function public.mm_books_freshness() from public, anon;
grant execute on function public.mm_books_freshness() to authenticated;