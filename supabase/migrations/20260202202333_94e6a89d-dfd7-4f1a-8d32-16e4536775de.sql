-- Cenovnik ploča po klijentu
CREATE TABLE public.client_plate_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plate_format_id UUID NOT NULL REFERENCES public.plate_formats(id) ON DELETE CASCADE,
  price_rsd NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Svaki klijent može imati samo jednu cenu po formatu
  UNIQUE(client_id, plate_format_id)
);

-- Enable RLS
ALTER TABLE public.client_plate_prices ENABLE ROW LEVEL SECURITY;

-- Policies - samo interni korisnici mogu čitati/pisati
CREATE POLICY "Internal users can view client plate prices"
  ON public.client_plate_prices
  FOR SELECT
  USING (public.has_any_role(array['admin', 'admin_plus', 'operator', 'superuser']::app_role[]));

CREATE POLICY "Admins can manage client plate prices"
  ON public.client_plate_prices
  FOR ALL
  USING (public.has_any_role(array['admin', 'admin_plus', 'superuser']::app_role[]));

-- Trigger za updated_at
CREATE TRIGGER update_client_plate_prices_updated_at
  BEFORE UPDATE ON public.client_plate_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();