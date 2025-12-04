-- Create paper types lookup table
CREATE TABLE public.digital_paper_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_paper_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view paper types" 
ON public.digital_paper_types FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage paper types" 
ON public.digital_paper_types FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert predefined paper types
INSERT INTO public.digital_paper_types (name, display_order) VALUES
  ('Ofsetni', 1),
  ('Kunzdruk 115g', 2),
  ('Kunzdruk 135g', 3),
  ('Kunzdruk 150g', 4),
  ('Kunzdruk 170g', 5),
  ('Kunzdruk 200g', 6),
  ('Kunzdruk 250g', 7),
  ('Kunzdruk 300g', 8),
  ('Kunzdruk 350g', 9);

-- Add new columns to digital_jobs table
ALTER TABLE public.digital_jobs
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS paper_type text,
  ADD COLUMN IF NOT EXISTS machine_sheet_format text NOT NULL DEFAULT '330x488',
  ADD COLUMN IF NOT EXISTS pieces_per_sheet integer,
  ADD COLUMN IF NOT EXISTS pieces_per_sheet_override integer,
  ADD COLUMN IF NOT EXISTS test_sheets integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS include_test_in_clicks boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finishing text,
  ADD COLUMN IF NOT EXISTS item_status text NOT NULL DEFAULT 'planned';

-- Update digital_settings to include available sheet formats
ALTER TABLE public.digital_settings
  ADD COLUMN IF NOT EXISTS available_sheet_formats jsonb NOT NULL DEFAULT '["330x488", "330x760"]'::jsonb;

-- Update existing digital_settings row
UPDATE public.digital_settings 
SET available_sheet_formats = '["330x488", "330x760"]'::jsonb
WHERE id IS NOT NULL;