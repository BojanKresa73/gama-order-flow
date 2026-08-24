-- ENUMs
CREATE TYPE public.complaint_status AS ENUM ('new','in_review','in_progress','resolved','rejected');
CREATE TYPE public.complaint_category AS ENUM ('job','quality','employee','deadline','other');

-- Counters
CREATE TABLE public.complaint_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.complaint_counters TO service_role;
ALTER TABLE public.complaint_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaint_counters_superuser_read" ON public.complaint_counters
  FOR SELECT TO authenticated USING (public.is_superuser(auth.uid()));

-- Complaints
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  category public.complaint_category NOT NULL DEFAULT 'other',
  about_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  severity integer NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  subject text NOT NULL,
  description text NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'new',
  resolution_note text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  due_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_complaints_client ON public.complaints(client_id);
CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_created ON public.complaints(created_at DESC);
CREATE INDEX idx_complaints_work_order ON public.complaints(work_order_id);

GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints_superuser_all" ON public.complaints
  FOR ALL TO authenticated
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

CREATE POLICY "complaints_client_select" ON public.complaints
  FOR SELECT TO authenticated
  USING (public.is_client_portal_user() AND client_id = public.current_user_client_id());

CREATE POLICY "complaints_client_insert" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_client_portal_user()
    AND client_id = public.current_user_client_id()
    AND created_by = auth.uid()
    AND status = 'new'
  );

-- Messages
CREATE TABLE public.complaint_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  is_internal boolean NOT NULL DEFAULT false,
  is_from_client boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_complaint_messages_complaint ON public.complaint_messages(complaint_id, created_at);

GRANT SELECT, INSERT ON public.complaint_messages TO authenticated;
GRANT ALL ON public.complaint_messages TO service_role;
ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaint_messages_superuser_all" ON public.complaint_messages
  FOR ALL TO authenticated
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

CREATE POLICY "complaint_messages_client_select" ON public.complaint_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND public.is_client_portal_user()
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.client_id = public.current_user_client_id()
    )
  );

CREATE POLICY "complaint_messages_client_insert" ON public.complaint_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal = false
    AND is_from_client = true
    AND author_id = auth.uid()
    AND public.is_client_portal_user()
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.client_id = public.current_user_client_id()
    )
  );

-- Attachments
CREATE TABLE public.complaint_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_complaint_attachments_complaint ON public.complaint_attachments(complaint_id);

GRANT SELECT, INSERT ON public.complaint_attachments TO authenticated;
GRANT ALL ON public.complaint_attachments TO service_role;
ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaint_attachments_superuser_all" ON public.complaint_attachments
  FOR ALL TO authenticated
  USING (public.is_superuser(auth.uid()))
  WITH CHECK (public.is_superuser(auth.uid()));

CREATE POLICY "complaint_attachments_client_select" ON public.complaint_attachments
  FOR SELECT TO authenticated
  USING (
    public.is_client_portal_user()
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.client_id = public.current_user_client_id()
    )
  );

CREATE POLICY "complaint_attachments_client_insert" ON public.complaint_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.is_client_portal_user()
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.client_id = public.current_user_client_id()
    )
    AND (
      SELECT count(*) FROM public.complaint_attachments a WHERE a.complaint_id = complaint_id
    ) < 5
  );

-- Events (audit)
CREATE TABLE public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_status public.complaint_status,
  new_status public.complaint_status,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_complaint_events_complaint ON public.complaint_events(complaint_id, created_at);

GRANT SELECT ON public.complaint_events TO authenticated;
GRANT ALL ON public.complaint_events TO service_role;
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaint_events_superuser_select" ON public.complaint_events
  FOR SELECT TO authenticated USING (public.is_superuser(auth.uid()));

CREATE POLICY "complaint_events_client_select" ON public.complaint_events
  FOR SELECT TO authenticated
  USING (
    public.is_client_portal_user()
    AND event_type = 'status_change'
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.client_id = public.current_user_client_id()
    )
  );

-- Numbering + timestamps + audit triggers
CREATE OR REPLACE FUNCTION public.next_complaint_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_num integer;
BEGIN
  INSERT INTO public.complaint_counters(year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = public.complaint_counters.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN 'REK-' || v_year || '-' || LPAD(v_num::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_complaint_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.complaint_number IS NULL OR NEW.complaint_number = '' THEN
    NEW.complaint_number := public.next_complaint_number();
  END IF;
  NEW.due_at := COALESCE(NEW.due_at, now() + interval '24 hours');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complaint_before_insert
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.fn_complaint_before_insert();

CREATE TRIGGER trg_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fn_complaint_log_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_events(complaint_id, event_type, new_status, actor_id)
    VALUES (NEW.id, 'created', NEW.status, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.complaint_events(complaint_id, event_type, old_status, new_status, actor_id, note)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, auth.uid(), NEW.resolution_note);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complaint_log_status_ins
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.fn_complaint_log_status();

CREATE TRIGGER trg_complaint_log_status_upd
  AFTER UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.fn_complaint_log_status();

-- Storage policies for private bucket 'complaints'
CREATE POLICY "complaints_storage_superuser_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'complaints' AND public.is_superuser(auth.uid()))
  WITH CHECK (bucket_id = 'complaints' AND public.is_superuser(auth.uid()));

CREATE POLICY "complaints_storage_client_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'complaints'
    AND public.is_client_portal_user()
    AND (storage.foldername(name))[1] = public.current_user_client_id()::text
  );

CREATE POLICY "complaints_storage_client_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaints'
    AND public.is_client_portal_user()
    AND (storage.foldername(name))[1] = public.current_user_client_id()::text
  );