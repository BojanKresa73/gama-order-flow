-- Create client_activities table
create table if not exists public.client_activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  type text check (type in ('poziv','email','sastanak','napomena')) not null,
  note text,
  created_by uuid,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.client_activities enable row level security;

-- RLS policies
create policy "Authenticated users can view client activities"
  on public.client_activities
  for select
  using (auth.uid() is not null);

create policy "Authenticated users can create client activities"
  on public.client_activities
  for insert
  with check (auth.uid() is not null);

-- Index for faster queries
create index idx_client_activities_client_id on public.client_activities(client_id);
create index idx_client_activities_created_at on public.client_activities(created_at desc);