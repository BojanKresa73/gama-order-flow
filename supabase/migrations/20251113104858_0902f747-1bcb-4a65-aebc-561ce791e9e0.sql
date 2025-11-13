-- Film settings table (default values for filming calculations)
CREATE TABLE IF NOT EXISTS film_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_width_mm integer NOT NULL DEFAULT 500,
  side_margin_mm integer NOT NULL DEFAULT 5,
  lead_trim_mm integer NOT NULL DEFAULT 10,
  tail_trim_mm integer NOT NULL DEFAULT 10,
  gap_mm integer NOT NULL DEFAULT 0,
  waste_percent numeric NOT NULL DEFAULT 3,
  cost_eur_per_m numeric NOT NULL DEFAULT 12.5,
  price_eur_per_m numeric NOT NULL DEFAULT 17,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add film_note column to work_orders
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS film_note text;

-- Film jobs table (individual filming items within a work order)
CREATE TABLE IF NOT EXISTS film_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  width_mm integer NOT NULL,
  height_mm integer NOT NULL,
  qty integer NOT NULL,
  allow_rotate_90 boolean NOT NULL DEFAULT true,
  margin_mm integer NOT NULL DEFAULT 0,
  note text,
  computed_rotation_deg integer,
  computed_m_per_piece numeric,
  computed_total_m numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Film cuts table (computed cut rows for preview/export)
CREATE TABLE IF NOT EXISTS film_cuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  film_job_id uuid NOT NULL REFERENCES film_jobs(id) ON DELETE CASCADE,
  rotation_deg integer NOT NULL,
  copies_per_row integer NOT NULL,
  rows_needed integer NOT NULL,
  length_m numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE film_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_cuts ENABLE ROW LEVEL SECURITY;

-- RLS policies for film_settings
CREATE POLICY "Authenticated users can view film settings"
  ON film_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage film settings"
  ON film_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for film_jobs
CREATE POLICY "Authenticated users can view film jobs"
  ON film_jobs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create film jobs"
  ON film_jobs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Operators and admins can update film jobs"
  ON film_jobs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admins can delete film jobs"
  ON film_jobs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for film_cuts
CREATE POLICY "Authenticated users can view film cuts"
  ON film_cuts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage film cuts"
  ON film_cuts FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Trigger for film_jobs updated_at
CREATE TRIGGER update_film_jobs_updated_at
  BEFORE UPDATE ON film_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for film_settings updated_at
CREATE TRIGGER update_film_settings_updated_at
  BEFORE UPDATE ON film_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default film settings if none exist
INSERT INTO film_settings (
  roll_width_mm,
  side_margin_mm,
  lead_trim_mm,
  tail_trim_mm,
  gap_mm,
  waste_percent,
  cost_eur_per_m,
  price_eur_per_m
)
SELECT 500, 5, 10, 10, 0, 3, 12.5, 17
WHERE NOT EXISTS (SELECT 1 FROM film_settings LIMIT 1);