-- Tabela za dnevne agregate potrošnje ploča
create table if not exists public.plate_usage_stats (
  usage_date    date        not null,
  client_id     uuid        null,  -- UUID da odgovara clients tabeli
  plate_format  text        not null,  -- naziv formata
  plates_used   integer     not null default 0,
  created_at    timestamptz not null default now(),
  primary key (usage_date, client_id, plate_format)
);

-- RLS
alter table public.plate_usage_stats enable row level security;

-- Svi autentifikovani mogu da vide statistike
create policy "Authenticated users can view stats"
on public.plate_usage_stats
for select
to authenticated
using (true);

-- Admini i operateri mogu da upisuju/ažuriraju agregate
create policy "Admins and operators can manage stats"
on public.plate_usage_stats
for all
to authenticated
using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'operator'::app_role));

-- Index za brže pretraživanje
create index if not exists idx_plate_usage_date on public.plate_usage_stats(usage_date desc);
create index if not exists idx_plate_usage_client on public.plate_usage_stats(client_id);
create index if not exists idx_plate_usage_format on public.plate_usage_stats(plate_format);