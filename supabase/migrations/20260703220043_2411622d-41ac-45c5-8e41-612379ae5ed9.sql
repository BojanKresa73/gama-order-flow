
-- Align quotes with GDC Order schema (Phase 1)

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotes_work_order_id_idx ON public.quotes(work_order_id);

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS finishing_cost_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finishing_qty_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
