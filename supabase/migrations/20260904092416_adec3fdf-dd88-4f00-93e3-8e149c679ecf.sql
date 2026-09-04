CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_select_authenticated" ON public.client_contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cc_write_internal" ON public.client_contacts
  FOR ALL TO authenticated
  USING (NOT public.is_client_portal_user())
  WITH CHECK (NOT public.is_client_portal_user());

CREATE INDEX idx_client_contacts_client ON public.client_contacts(client_id);

CREATE TRIGGER update_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.work_orders
  ADD COLUMN sales_rep_name text,
  ADD COLUMN sales_rep_email text;