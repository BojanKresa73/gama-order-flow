-- Add indexes for better query performance on plate_usage_stats

-- Index for date + format queries
create index if not exists idx_pus_date_format
  on public.plate_usage_stats (usage_date, plate_format);

-- Index for client + date queries
create index if not exists idx_pus_client_date
  on public.plate_usage_stats (client_id, usage_date);

comment on index idx_pus_date_format is 'Optimizes queries filtering by date and plate format';
comment on index idx_pus_client_date is 'Optimizes queries filtering by client and date';