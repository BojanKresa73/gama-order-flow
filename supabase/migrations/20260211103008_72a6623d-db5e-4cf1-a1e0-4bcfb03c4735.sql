
-- Add plate format group to plate_formats for B1/B2/B3 classification
ALTER TABLE public.plate_formats ADD COLUMN IF NOT EXISTS format_group text;

-- Classify existing formats:
-- B1: ~1030-1060mm wide
UPDATE public.plate_formats SET format_group = 'B1' WHERE format_name IN ('1030×790','1030x785','1040x800','1050x795','1060x795');
-- B2: ~724-745mm wide  
UPDATE public.plate_formats SET format_group = 'B2' WHERE format_name IN ('724x615','730x605','740x605','745×605');
-- B3: ~450-510mm wide
UPDATE public.plate_formats SET format_group = 'B3' WHERE format_name IN ('450x370','510x400');

-- Add ctp_machine_id to work_orders
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS ctp_machine_id text;

-- Create machine speeds table
CREATE TABLE public.ctp_machine_speeds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id text NOT NULL,
  machine_name text NOT NULL,
  format_group text NOT NULL,
  base_seconds_per_plate numeric NOT NULL,
  avg_seconds_per_plate numeric,
  sample_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(machine_id, format_group)
);

ALTER TABLE public.ctp_machine_speeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read machine speeds"
  ON public.ctp_machine_speeds FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update machine speeds"
  ON public.ctp_machine_speeds FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create job timing log
CREATE TABLE public.ctp_job_timing_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  machine_id text NOT NULL,
  format_group text NOT NULL,
  total_plates integer NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  actual_seconds_per_plate numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ctp_job_timing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read timing log"
  ON public.ctp_job_timing_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert timing log"
  ON public.ctp_job_timing_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update timing log"
  ON public.ctp_job_timing_log FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Insert base speeds
-- CTP 1: B1=80s, B2=65s, B3=27s
-- CTP 2: B1=120s, B2=86s, B3=60s
INSERT INTO public.ctp_machine_speeds (machine_id, machine_name, format_group, base_seconds_per_plate) VALUES
  ('ctp_1', 'CTP 1', 'B1', 80),
  ('ctp_1', 'CTP 1', 'B2', 65),
  ('ctp_1', 'CTP 1', 'B3', 27),
  ('ctp_2', 'CTP 2', 'B1', 120),
  ('ctp_2', 'CTP 2', 'B2', 86),
  ('ctp_2', 'CTP 2', 'B3', 60);

-- Function to recalculate avg after job completion (last 20 jobs moving average)
CREATE OR REPLACE FUNCTION public.recalc_ctp_avg_speed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND NEW.actual_seconds_per_plate IS NOT NULL THEN
    UPDATE public.ctp_machine_speeds
    SET avg_seconds_per_plate = sub.avg_spp,
        sample_count = sub.cnt,
        updated_at = now()
    FROM (
      SELECT AVG(actual_seconds_per_plate) as avg_spp, COUNT(*) as cnt
      FROM (
        SELECT actual_seconds_per_plate
        FROM public.ctp_job_timing_log
        WHERE machine_id = NEW.machine_id
          AND format_group = NEW.format_group
          AND completed_at IS NOT NULL
          AND actual_seconds_per_plate IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 20
      ) recent
    ) sub
    WHERE machine_id = NEW.machine_id AND format_group = NEW.format_group;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_recalc_ctp_avg_speed
  AFTER INSERT OR UPDATE ON public.ctp_job_timing_log
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_ctp_avg_speed();
