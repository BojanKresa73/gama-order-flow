-- Check if work_order_events exists and modify it for tracking invalidation/deletion
-- Drop the existing table to recreate with the new structure
DROP TABLE IF EXISTS public.work_order_events CASCADE;

-- Create work_order_events table for tracking invalidation and deletion
CREATE TABLE IF NOT EXISTS public.work_order_events (
  id bigserial PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,                -- 'invalidate' | 'delete' | 'created' | 'closed' etc.
  payload jsonb,                           -- reason, old status, etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for faster lookups by work order
CREATE INDEX IF NOT EXISTS idx_wo_events_wo ON public.work_order_events(work_order_id);

-- Enable RLS
ALTER TABLE public.work_order_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "woe_select" ON public.work_order_events
  FOR SELECT
  USING (current_user_is_active());

CREATE POLICY "woe_insert" ON public.work_order_events
  FOR INSERT
  WITH CHECK (current_user_is_active());