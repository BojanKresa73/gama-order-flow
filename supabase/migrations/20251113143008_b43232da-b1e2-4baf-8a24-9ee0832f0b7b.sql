-- Create digital_settings table
CREATE TABLE IF NOT EXISTS public.digital_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_width_mm INT NOT NULL DEFAULT 488,
  sheet_height_mm INT NOT NULL DEFAULT 330,
  waste_percent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on digital_settings
ALTER TABLE public.digital_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for digital_settings
CREATE POLICY "Authenticated users can view digital settings"
  ON public.digital_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage digital settings"
  ON public.digital_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create price_list_digital table
CREATE TABLE IF NOT EXISTS public.price_list_digital (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  break_qty INT NOT NULL,
  price_per_sheet NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (break_qty)
);

-- Enable RLS on price_list_digital
ALTER TABLE public.price_list_digital ENABLE ROW LEVEL SECURITY;

-- RLS policies for price_list_digital
CREATE POLICY "Authenticated users can view price list"
  ON public.price_list_digital
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage price list"
  ON public.price_list_digital
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create digital_jobs table
CREATE TABLE IF NOT EXISTS public.digital_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  finished_w_mm INT NOT NULL,
  finished_h_mm INT NOT NULL,
  qty INT NOT NULL,
  pages INT NOT NULL DEFAULT 1,
  print_sides TEXT NOT NULL CHECK (print_sides IN ('4/4','4/1','4/0','1/1','1/0')),
  binding TEXT NULL CHECK (binding IN ('bez_poveza','binder','klamovanje','spirala','perfect')),
  lamination TEXT NULL CHECK (lamination IN ('none','1/0','1/1')),
  lamination_type TEXT NULL CHECK (lamination_type IN ('mat','sjaj')),
  paper_gsm INT NULL,
  cover_gsm INT NULL,
  folds INT NULL DEFAULT 0,
  is_test_print BOOLEAN NOT NULL DEFAULT false,
  computed_nup INT,
  computed_sheets_per_copy INT,
  computed_total_sheets INT,
  computed_color_clicks INT,
  computed_mono_clicks INT,
  computed_price_per_sheet NUMERIC,
  computed_line_total NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on digital_jobs
ALTER TABLE public.digital_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for digital_jobs
CREATE POLICY "Authenticated users can view digital jobs"
  ON public.digital_jobs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create digital jobs"
  ON public.digital_jobs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Operators and admins can update digital jobs"
  ON public.digital_jobs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admins can delete digital jobs"
  ON public.digital_jobs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_digital_settings_updated_at
  BEFORE UPDATE ON public.digital_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_list_digital_updated_at
  BEFORE UPDATE ON public.price_list_digital
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_digital_jobs_updated_at
  BEFORE UPDATE ON public.digital_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default digital settings
INSERT INTO public.digital_settings (sheet_width_mm, sheet_height_mm, waste_percent)
VALUES (488, 330, 0)
ON CONFLICT DO NOTHING;

-- Insert default price list (example values - adjust as needed)
INSERT INTO public.price_list_digital (break_qty, price_per_sheet) VALUES
  (1, 2.50),
  (10, 2.00),
  (50, 1.50),
  (100, 1.20),
  (200, 1.00),
  (500, 0.80)
ON CONFLICT (break_qty) DO NOTHING;