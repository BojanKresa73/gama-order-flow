-- Add CRM fields to clients table
ALTER TABLE public.clients
ADD COLUMN last_activity_at timestamp with time zone,
ADD COLUMN last_contacted_at timestamp with time zone,
ADD COLUMN next_follow_up_at timestamp with time zone,
ADD COLUMN owner_user_id uuid;

-- Add comment explaining we don't use FK to auth.users (per Lovable best practices)
COMMENT ON COLUMN public.clients.owner_user_id IS 'User ID from auth.users - no FK constraint by design';

-- Create index for follow-up queries
CREATE INDEX idx_clients_next_follow_up ON public.clients(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;