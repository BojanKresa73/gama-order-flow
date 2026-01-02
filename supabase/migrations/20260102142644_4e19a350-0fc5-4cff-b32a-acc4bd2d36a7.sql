-- Create procurement orders table (narudžbine za nabavku)
CREATE TABLE public.procurement_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_arrival_date DATE,
  actual_arrival_date DATE,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'in_transit', 'customs', 'arrived', 'cancelled')),
  transport_cost NUMERIC(12, 2) DEFAULT 0,
  other_costs NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create procurement order items table (stavke po formatima)
CREATE TABLE public.procurement_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  procurement_order_id UUID NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  plate_format_id UUID NOT NULL REFERENCES plate_formats(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_m2 NUMERIC(10, 4) NOT NULL,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.procurement_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for procurement_orders
CREATE POLICY "Authenticated users can view procurement orders"
  ON public.procurement_orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and operators can create procurement orders"
  ON public.procurement_orders FOR INSERT
  WITH CHECK (current_user_is_active() AND current_user_role() IN ('superuser', 'admin', 'operator'));

CREATE POLICY "Admins and operators can update procurement orders"
  ON public.procurement_orders FOR UPDATE
  USING (current_user_is_active() AND current_user_role() IN ('superuser', 'admin', 'operator'));

CREATE POLICY "Only superuser can delete procurement orders"
  ON public.procurement_orders FOR DELETE
  USING (current_user_role() = 'superuser');

-- RLS policies for procurement_order_items
CREATE POLICY "Authenticated users can view procurement items"
  ON public.procurement_order_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and operators can manage procurement items"
  ON public.procurement_order_items FOR ALL
  USING (current_user_is_active() AND current_user_role() IN ('superuser', 'admin', 'operator'));

-- Trigger for updated_at
CREATE TRIGGER update_procurement_orders_updated_at
  BEFORE UPDATE ON public.procurement_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();