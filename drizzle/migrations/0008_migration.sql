create table public.mm_review_resolutions (
  issue_key text primary key,
  category text not null,
  title text not null,
  question text,
  amount_rsd numeric,
  confirmation_document text not null,
  confirmed_on date not null,
  note text,
  resolved_by uuid not null default auth.uid(),
  resolved_at timestamptz not null default now()
);
alter table public.mm_review_resolutions enable row level security;
grant select, insert, update, delete on public.mm_review_resolutions to authenticated;
create policy "finance read" on public.mm_review_resolutions for select to authenticated using (public.has_finance_access());
create policy "finance insert" on public.mm_review_resolutions for insert to authenticated with check (public.has_finance_access() and resolved_by = auth.uid());
create policy "finance update" on public.mm_review_resolutions for update to authenticated using (public.has_finance_access()) with check (public.has_finance_access());
create policy "finance delete" on public.mm_review_resolutions for delete to authenticated using (public.has_finance_access());