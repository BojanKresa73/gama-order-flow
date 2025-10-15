-- Add notification email to clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS notification_email text;

-- Create delivery notes table
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  delivery_number text NOT NULL,
  client_name text NOT NULL,
  client_pib text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  opened_at timestamp with time zone NOT NULL,
  closed_at timestamp with time zone NOT NULL,
  items jsonb NOT NULL,
  sent_to_email text,
  sent_at timestamp with time zone
);

-- Enable RLS on delivery notes
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

-- Policies for delivery notes
CREATE POLICY "Authenticated users can view delivery notes"
  ON public.delivery_notes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert delivery notes"
  ON public.delivery_notes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_delivery_notes_work_order_id 
  ON public.delivery_notes(work_order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_created_at 
  ON public.delivery_notes(created_at DESC);