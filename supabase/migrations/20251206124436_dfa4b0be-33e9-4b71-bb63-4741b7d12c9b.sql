-- Enum za tip velikog formata
CREATE TYPE public.large_format_type AS ENUM ('roll', 'rigid');

-- Enum za tip materijala rolne
CREATE TYPE public.roll_material_type AS ENUM (
  'self_adhesive_matte',
  'self_adhesive_glossy', 
  'cut_vinyl',
  'tarpaulin',
  'mesh_banner',
  'other'
);

-- Enum za tip krutog materijala
CREATE TYPE public.rigid_material_type AS ENUM (
  'forex',
  'dibond',
  'plexiglass',
  'cardboard',
  'wood',
  'other'
);

-- Tabela za radne naloge velikog formata
CREATE TABLE public.large_format_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  format_type large_format_type NOT NULL,
  
  -- Za rolne
  roll_width_mm INTEGER, -- 1370, 1520, 1600
  roll_material roll_material_type,
  
  -- Za ploče
  rigid_material rigid_material_type,
  sheet_width_mm INTEGER,
  sheet_height_mm INTEGER,
  
  -- Zajedničko
  lamination_type TEXT, -- mat, sjaj, bez
  total_area_m2 NUMERIC(10,4),
  
  -- Dorada za rolne (cerada/mesh)
  weld_edges BOOLEAN DEFAULT false,
  add_grommets BOOLEAN DEFAULT false,
  grommet_spacing_cm INTEGER,
  
  -- Dorada za ploče
  cnc_cut BOOLEAN DEFAULT false,
  marker_margin_cm INTEGER DEFAULT 2,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela za pojedinačne stavke/fajlove
CREATE TABLE public.large_format_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  large_format_order_id UUID NOT NULL REFERENCES public.large_format_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  
  -- Izračunate vrednosti
  area_m2 NUMERIC(10,4),
  rotated BOOLEAN DEFAULT false,
  
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dodaj novi kind za work_orders
ALTER TYPE public.work_order_kind ADD VALUE 'ROLNA';
ALTER TYPE public.work_order_kind ADD VALUE 'PLOCA';

-- Dodaj novi order_type
ALTER TYPE public.work_order_type ADD VALUE 'large_format';

-- RLS
ALTER TABLE public.large_format_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.large_format_jobs ENABLE ROW LEVEL SECURITY;

-- RLS politike za large_format_orders
CREATE POLICY "Authenticated users can view large format orders"
ON public.large_format_orders FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operators and admins can create large format orders"
ON public.large_format_orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operators and admins can update large format orders"
ON public.large_format_orders FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admins can delete large format orders"
ON public.large_format_orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS politike za large_format_jobs
CREATE POLICY "Authenticated users can view large format jobs"
ON public.large_format_jobs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operators and admins can create large format jobs"
ON public.large_format_jobs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operators and admins can update large format jobs"
ON public.large_format_jobs FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admins can delete large format jobs"
ON public.large_format_jobs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Kreiraj sekvence za brojeve naloga
CREATE SEQUENCE IF NOT EXISTS public.seq_workorder_rolna START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_workorder_ploca START 1;

-- Trigger za updated_at
CREATE TRIGGER update_large_format_orders_updated_at
BEFORE UPDATE ON public.large_format_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_large_format_jobs_updated_at
BEFORE UPDATE ON public.large_format_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ažuriraj trigger za display_order_number
CREATE OR REPLACE FUNCTION public.fn_set_display_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  n bigint;
  pref text;
begin
  if new.display_order_number is not null then
    return new;
  end if;

  case new.kind
    when 'CTP'         then n := nextval('seq_workorder_ctp');        pref := 'CTP';
    when 'DIGITALA'    then n := nextval('seq_workorder_digitala');   pref := 'DIG';
    when 'FILMOVANJE'  then n := nextval('seq_workorder_filmovanje'); pref := 'FILM';
    when 'RAZNO'       then n := nextval('seq_workorder_razno');      pref := 'RZN';
    when 'ROLNA'       then n := nextval('seq_workorder_rolna');      pref := 'ROL';
    when 'PLOCA'       then n := nextval('seq_workorder_ploca');      pref := 'PLO';
  end case;

  new.display_order_number :=
    pref || '-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(n::text, 6, '0');

  return new;
end$function$;