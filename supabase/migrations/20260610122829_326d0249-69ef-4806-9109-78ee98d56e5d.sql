
-- 1) Product types
CREATE TABLE public.digital_product_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  default_paper text,
  default_print_sides text,
  default_machine_sheet_format text,
  supports_cover boolean NOT NULL DEFAULT false,
  supports_pages boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_product_types TO authenticated;
GRANT ALL ON public.digital_product_types TO service_role;
ALTER TABLE public.digital_product_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY dpt_read_all ON public.digital_product_types FOR SELECT TO authenticated USING (true);
CREATE POLICY dpt_admin_write ON public.digital_product_types FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- 2) Finishing types (catalog of finishings)
CREATE TABLE public.digital_finishing_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL, -- povez | plastifikacija | secenje | numeracija | ostalo
  pricing_model text NOT NULL DEFAULT 'per_copy',
    -- per_copy | per_item | per_sheet | per_m2 | fixed | fixed_plus_per_copy
  has_variants boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_finishing_types TO authenticated;
GRANT ALL ON public.digital_finishing_types TO service_role;
ALTER TABLE public.digital_finishing_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY dft_read_all ON public.digital_finishing_types FOR SELECT TO authenticated USING (true);
CREATE POLICY dft_admin_write ON public.digital_finishing_types FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- 3) Finishing prices (variants + price entries)
CREATE TABLE public.digital_finishing_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finishing_code text NOT NULL REFERENCES public.digital_finishing_types(code) ON DELETE CASCADE,
  variant text NOT NULL DEFAULT '',
  fixed_cost numeric(12,4) NOT NULL DEFAULT 0,
  unit_price numeric(12,4) NOT NULL DEFAULT 0,
  min_qty int NOT NULL DEFAULT 0,
  max_qty int,
  notes text,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dfp_finishing_idx ON public.digital_finishing_prices (finishing_code, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_finishing_prices TO authenticated;
GRANT ALL ON public.digital_finishing_prices TO service_role;
ALTER TABLE public.digital_finishing_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY dfp_read_all ON public.digital_finishing_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY dfp_admin_write ON public.digital_finishing_prices FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_dpt_updated BEFORE UPDATE ON public.digital_product_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dft_updated BEFORE UPDATE ON public.digital_finishing_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dfp_updated BEFORE UPDATE ON public.digital_finishing_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Extend digital_jobs
ALTER TABLE public.digital_jobs
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS page_count int,
  ADD COLUMN IF NOT EXISTS page_format text,
  ADD COLUMN IF NOT EXISTS page_width_mm int,
  ADD COLUMN IF NOT EXISTS page_height_mm int,
  ADD COLUMN IF NOT EXISTS has_cover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_paper text,
  ADD COLUMN IF NOT EXISTS cover_print_sides text,
  ADD COLUMN IF NOT EXISTS cover_lamination text,
  ADD COLUMN IF NOT EXISTS binding_code text,
  ADD COLUMN IF NOT EXISTS finishings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS finishings_total numeric(12,2) NOT NULL DEFAULT 0;

-- 5) Seed product types
INSERT INTO public.digital_product_types (code, name, description, display_order, default_paper, default_print_sides, default_machine_sheet_format, supports_cover, supports_pages) VALUES
  ('katalog',  'Katalog / brošura (višestrano)', 'Višestrani proizvod sa unutrašnjošću i opcionalnim posebnim koricama', 10, 'Kunzdruk 135g', '4/4', '760x330', true,  true),
  ('flajer',   'Flajer / letak',                 'Jednostrano ili obostrano štampani letak',                            20, 'Kunzdruk 135g', '4/4', '488x330', false, false),
  ('vizit',    'Vizit karta',                    'Jednostrano ili obostrano vizit karte',                                30, 'Kunzdruk 300g', '4/4', '488x330', false, false),
  ('poster',   'Plakat / poster',                'Jedan list, jednostrano',                                              40, 'Kunzdruk 150g', '4/0', '488x330', false, false),
  ('blok',     'Blok / memorandum / NCR',        'Sa numeracijom, perforacijom ili lepljenjem u blokove',                50, 'Ofsetni 80g',   '4/0', '488x330', false, false),
  ('custom',   'Po meri (custom)',               'Slobodan unos',                                                        99, 'Kunzdruk 135g', '4/4', '488x330', true,  true)
ON CONFLICT (code) DO NOTHING;

-- 6) Seed finishing types
INSERT INTO public.digital_finishing_types (code, name, category, pricing_model, has_variants, display_order, description) VALUES
  ('povez',         'Povez',           'povez',         'fixed_plus_per_copy', true, 10, 'Povez za višestrane proizvode'),
  ('plastifikacija','Plastifikacija',  'plastifikacija','per_copy',            true, 20, 'Plastifikacija mat ili sjajna, 1- ili 2-strano'),
  ('secenje',       'Sečenje',         'secenje',       'fixed_plus_per_copy', false, 30, 'Sečenje na format'),
  ('biganje',       'Biganje',         'secenje',       'fixed_plus_per_copy', false, 35, 'Biganje pre savijanja'),
  ('falcovanje',    'Falcovanje',      'secenje',       'per_copy',            false, 36, 'Mašinsko savijanje'),
  ('numeracija',    'Numeracija',      'numeracija',    'per_copy',            false, 40, 'Numeracija pojedinačnih primeraka'),
  ('perforacija',   'Perforacija',     'numeracija',    'fixed_plus_per_copy', false, 50, 'Perforacija linije'),
  ('rupicenje',     'Rupičenje',       'numeracija',    'per_copy',            false, 60, 'Bušenje rupa')
ON CONFLICT (code) DO NOTHING;

-- 7) Seed finishing prices (varijante)
INSERT INTO public.digital_finishing_prices (finishing_code, variant, fixed_cost, unit_price, display_order) VALUES
  ('povez',          'Klamovanje (žičano)',      5.00, 0.05, 10),
  ('povez',          'Spiralni povez',           5.00, 0.30, 20),
  ('povez',          'Lepljeni povez',          10.00, 0.40, 30),
  ('povez',          'Šivenje koncem',          15.00, 0.60, 40),
  ('plastifikacija', '1-strano mat',             0.00, 0.20, 10),
  ('plastifikacija', '1-strano sjajna',          0.00, 0.20, 20),
  ('plastifikacija', '2-strano mat',             0.00, 0.35, 30),
  ('plastifikacija', '2-strano sjajna',          0.00, 0.35, 40),
  ('secenje',        '',                         5.00, 0.00, 10),
  ('biganje',        '',                         5.00, 0.02, 10),
  ('falcovanje',     '',                         0.00, 0.05, 10),
  ('numeracija',     '',                         0.00, 0.02, 10),
  ('perforacija',    '',                         3.00, 0.02, 10),
  ('rupicenje',      '',                         0.00, 0.01, 10)
ON CONFLICT DO NOTHING;
