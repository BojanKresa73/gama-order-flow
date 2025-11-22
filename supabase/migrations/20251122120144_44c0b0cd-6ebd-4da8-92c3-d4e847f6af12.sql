-- Add columns for invalidated work orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invalid_reason text;

-- Add soft delete column
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_deleted_at ON public.work_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_invalidated_at ON public.work_orders(invalidated_at);