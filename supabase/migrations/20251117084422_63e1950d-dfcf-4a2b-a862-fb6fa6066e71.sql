-- Create email_jobs table for managing email sending queue
create table if not exists public.email_jobs (
  id            bigserial primary key,
  work_order_id uuid        not null references public.work_orders(id) on delete cascade,
  client_email  text        not null,
  subject       text        not null,
  html_body     text        not null,
  attachment_url text,
  status        text        not null default 'pending', -- pending|sent|error
  error_msg     text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

-- Index for efficiently querying pending jobs
create index if not exists idx_email_jobs_status on public.email_jobs(status, created_at);

-- Enable RLS
alter table public.email_jobs enable row level security;

-- Authenticated users can view email jobs
create policy "Authenticated users can view email jobs"
  on public.email_jobs
  for select
  using (auth.uid() is not null);

-- System can insert email jobs
create policy "System can insert email jobs"
  on public.email_jobs
  for insert
  with check (auth.uid() is not null);

-- System can update email jobs (for status updates)
create policy "System can update email jobs"
  on public.email_jobs
  for update
  using (auth.uid() is not null);