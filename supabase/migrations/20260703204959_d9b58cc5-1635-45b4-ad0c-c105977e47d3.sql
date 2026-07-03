-- ============================================================================
-- Phase 1: Advanced Quotes module (ported from GDC Order project)
-- Runs alongside existing quick_calc_quotes (untouched).
-- ============================================================================

-- Prospect flag on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_prospect boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_clients_is_prospect
  ON public.clients(is_prospect) WHERE is_prospect = true;

-- Quote number sequence
CREATE SEQUENCE IF NOT EXISTS seq_quote_number START 1;

-- ============================================================================
-- quotes
-- ============================================================================
CREATE TABLE public.quotes (
  id                        UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number              TEXT NOT NULL UNIQUE,
  client_id                 UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,

  -- Status workflow (superseded added later)
  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','sent','accepted','rejected','expired','superseded')),

  -- Pricing
  total_price               NUMERIC NOT NULL DEFAULT 0,
  discount_percent          NUMERIC DEFAULT 0,
  final_price               NUMERIC NOT NULL DEFAULT 0,
  default_markup_percent    NUMERIC NOT NULL DEFAULT 100,

  -- Validity
  valid_days                INTEGER NOT NULL DEFAULT 14,
  expires_at                TIMESTAMPTZ,
  sent_at                   TIMESTAMPTZ,

  -- Revisions
  parent_quote_id           UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  revision_number           INTEGER NOT NULL DEFAULT 1,

  -- Terms
  payment_terms             TEXT,
  delivery_days             INTEGER,
  notes                     TEXT,
  internal_notes            TEXT,
  job_name                  TEXT,

  -- Terrain visits
  terrain_visits_count      INTEGER NOT NULL DEFAULT 0,
  terrain_visit_price_eur   NUMERIC NOT NULL DEFAULT 20,
  terrain_visits_cost       NUMERIC NOT NULL DEFAULT 0,

  -- Install info
  install_address           TEXT,
  install_date              DATE,
  install_time              TEXT,
  install_contact           TEXT,
  install_phone             TEXT,
  install_notes             TEXT,

  -- Delivery info
  delivery_address          TEXT,
  delivery_date             DATE,
  delivery_time             TEXT,
  delivery_contact          TEXT,
  delivery_phone            TEXT,
  delivery_notes            TEXT,

  -- FX
  exchange_rate_used        NUMERIC NOT NULL DEFAULT 117.55,

  -- Tracking
  created_by                UUID NOT NULL REFERENCES public.profiles(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_client_id       ON public.quotes(client_id);
CREATE INDEX idx_quotes_status          ON public.quotes(status);
CREATE INDEX idx_quotes_created_at      ON public.quotes(created_at DESC);
CREATE INDEX idx_quotes_quote_number    ON public.quotes(quote_number);
CREATE INDEX idx_quotes_parent_quote_id ON public.quotes(parent_quote_id);
CREATE INDEX idx_quotes_job_name        ON public.quotes(job_name);
CREATE INDEX idx_quotes_expires_at      ON public.quotes(expires_at) WHERE status = 'sent';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- quote_items
-- Note: material_id/service_id are UUIDs without FK — those catalogs live in
-- the GDC readonly Supabase (supabaseGDC client).
-- ============================================================================
CREATE TABLE public.quote_items (
  id                              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id                        UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,

  item_type                       TEXT NOT NULL CHECK (item_type IN ('digital','large_format','service','razno')),

  -- Common
  name                            TEXT NOT NULL,
  description                     TEXT,
  quantity                        INTEGER NOT NULL DEFAULT 1,

  -- Dimensions
  width_mm                        INTEGER,
  height_mm                       INTEGER,

  -- Digital
  pages                           INTEGER,
  print_sides                     TEXT NOT NULL DEFAULT '4/0' CHECK (print_sides IN ('4/0','4/4')),
  paper_type                      TEXT,
  paper_gsm                       INTEGER,
  sheet_format                    TEXT,
  toner_cost_per_m2_eur           NUMERIC,
  digital_spec                    JSONB,

  -- Large format
  material_id                     UUID,
  material_name                   TEXT,
  area_m2                         NUMERIC,

  -- Service
  service_id                      UUID,
  service_name                    TEXT,

  -- Pricing
  unit_cost                       NUMERIC NOT NULL DEFAULT 0,
  unit_price                      NUMERIC NOT NULL DEFAULT 0,
  custom_price                    NUMERIC,
  line_total                      NUMERIC NOT NULL DEFAULT 0,
  cost_per_m2                     NUMERIC,
  markup_percent                  NUMERIC,
  source_category                 TEXT,
  min_qty_per_order               NUMERIC,
  yearly_qty                      NUMERIC,

  -- Billing layer
  billable_qty                    NUMERIC,
  billable_unit                   TEXT DEFAULT 'kom',

  -- Razno
  supplier_name                   TEXT,
  supplier_price                  NUMERIC,

  -- Installation
  installation_standard_enabled   BOOLEAN NOT NULL DEFAULT false,
  installation_price_per_m2       NUMERIC NOT NULL DEFAULT 5,
  installation_fixed_start        NUMERIC NOT NULL DEFAULT 20,
  installation_high_enabled       BOOLEAN NOT NULL DEFAULT false,
  installation_high_price_per_m2  NUMERIC NOT NULL DEFAULT 10,
  installation_high_fixed_start   NUMERIC NOT NULL DEFAULT 100,
  installation_cost               NUMERIC NOT NULL DEFAULT 0,

  -- Large-format finishing
  finishing_enabled               BOOLEAN NOT NULL DEFAULT false,
  finishing_grommets              BOOLEAN NOT NULL DEFAULT false,
  finishing_weld_edges            BOOLEAN NOT NULL DEFAULT false,
  finishing_sleeve                BOOLEAN NOT NULL DEFAULT false,
  finishing_joining               BOOLEAN NOT NULL DEFAULT false,
  finishing_lamination            BOOLEAN NOT NULL DEFAULT false,
  finishing_cutting               BOOLEAN NOT NULL DEFAULT false,
  finishing_creasing              BOOLEAN NOT NULL DEFAULT false,
  finishing_ruter                 BOOLEAN NOT NULL DEFAULT false,
  finishing_v_cut                 BOOLEAN NOT NULL DEFAULT false,
  finishing_kasiranje             BOOLEAN NOT NULL DEFAULT false,
  finishing_lepljenje             BOOLEAN NOT NULL DEFAULT false,
  finishing_cost                  NUMERIC NOT NULL DEFAULT 0,
  finishing_notes                 TEXT,

  -- Sheet finishing
  sheet_finishing_enabled         BOOLEAN NOT NULL DEFAULT false,
  sf_cutting                      BOOLEAN NOT NULL DEFAULT false,
  sf_creasing                     BOOLEAN NOT NULL DEFAULT false,
  sf_folding                      BOOLEAN NOT NULL DEFAULT false,
  sf_perforation                  BOOLEAN NOT NULL DEFAULT false,
  sf_hole_punching                BOOLEAN NOT NULL DEFAULT false,
  sf_stapling                     BOOLEAN NOT NULL DEFAULT false,
  sf_spiral_binding               BOOLEAN NOT NULL DEFAULT false,
  sf_thermal_binding              BOOLEAN NOT NULL DEFAULT false,
  sf_thread_sewing                BOOLEAN NOT NULL DEFAULT false,
  sf_hardcover                    BOOLEAN NOT NULL DEFAULT false,
  sf_softcover                    BOOLEAN NOT NULL DEFAULT false,
  sf_numbering                    BOOLEAN NOT NULL DEFAULT false,
  sf_block_gluing                 BOOLEAN NOT NULL DEFAULT false,
  sf_lamination                   BOOLEAN NOT NULL DEFAULT false,
  sf_uv_partial                   BOOLEAN NOT NULL DEFAULT false,
  sf_uv_full                      BOOLEAN NOT NULL DEFAULT false,
  sf_die_cutting                  BOOLEAN NOT NULL DEFAULT false,
  sf_grommets                     BOOLEAN NOT NULL DEFAULT false,
  sf_mounting                     BOOLEAN NOT NULL DEFAULT false,
  sf_gold_foil                    BOOLEAN NOT NULL DEFAULT false,
  sheet_finishing_notes           TEXT,

  order_index                     INTEGER NOT NULL DEFAULT 0,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_items_quote_id     ON public.quote_items(quote_id);
CREATE INDEX idx_quote_items_material_id  ON public.quote_items(material_id);
CREATE INDEX idx_quote_items_item_type    ON public.quote_items(item_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- quote_collaborators
-- ============================================================================
CREATE TABLE public.quote_collaborators (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  added_by   UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quote_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_collaborators TO authenticated;
GRANT ALL ON public.quote_collaborators TO service_role;

ALTER TABLE public.quote_collaborators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_quote_collaborator(_quote_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quote_collaborators
    WHERE quote_id = _quote_id AND user_id = _user_id
  );
$$;

-- ============================================================================
-- quote_activities (change log)
-- ============================================================================
CREATE TABLE public.quote_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     UUID NOT NULL,
  user_id      UUID,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL DEFAULT 'quote',
  entity_id    UUID,
  item_name    TEXT,
  field_name   TEXT,
  old_value    TEXT,
  new_value    TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_activities_quote_id ON public.quote_activities(quote_id, created_at DESC);
CREATE INDEX idx_quote_activities_user_id  ON public.quote_activities(user_id);

GRANT SELECT, INSERT ON public.quote_activities TO authenticated;
GRANT ALL ON public.quote_activities TO service_role;

ALTER TABLE public.quote_activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- quote_expiry_notifications
-- ============================================================================
CREATE TABLE public.quote_expiry_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  days_before     INTEGER NOT NULL,
  notified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_email TEXT,
  UNIQUE (quote_id, days_before)
);

GRANT SELECT ON public.quote_expiry_notifications TO authenticated;
GRANT ALL ON public.quote_expiry_notifications TO service_role;

ALTER TABLE public.quote_expiry_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Triggers: quote number, expiry, updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_year TEXT; v_seq BIGINT;
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    v_year := TO_CHAR(COALESCE(NEW.created_at, now()), 'YYYY');
    v_seq := nextval('seq_quote_number');
    NEW.quote_number := 'PON-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER tr_generate_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.generate_quote_number();

CREATE OR REPLACE FUNCTION public.set_quote_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status = 'draft' AND NEW.sent_at IS NULL THEN
    NEW.sent_at := now();
    NEW.expires_at := now() + (NEW.valid_days || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER tr_set_quote_expiry
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_quote_expiry();

CREATE OR REPLACE FUNCTION public.expire_old_quotes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes
     SET status = 'expired', updated_at = now()
   WHERE status = 'sent' AND expires_at IS NOT NULL AND expires_at < now();
END; $$;

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Prospect auto-unflag on quote acceptance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_quote_accepted_unflag_prospect()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.clients
       SET is_prospect = false, updated_at = now()
     WHERE id = NEW.client_id AND is_prospect = true;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quote_accepted_unflag_prospect
  AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_quote_accepted_unflag_prospect();

-- ============================================================================
-- Activity log triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_log_quote_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'status_changed', 'quote', NEW.id, 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.discount_percent IS DISTINCT FROM OLD.discount_percent THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Popust (%)', OLD.discount_percent::text, NEW.discount_percent::text);
  END IF;
  IF NEW.default_markup_percent IS DISTINCT FROM OLD.default_markup_percent THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Default marža (%)', OLD.default_markup_percent::text, NEW.default_markup_percent::text);
  END IF;
  IF NEW.valid_days IS DISTINCT FROM OLD.valid_days THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Rok važenja (dana)', OLD.valid_days::text, NEW.valid_days::text);
  END IF;
  IF NEW.payment_terms IS DISTINCT FROM OLD.payment_terms THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Uslovi plaćanja', OLD.payment_terms, NEW.payment_terms);
  END IF;
  IF NEW.delivery_days IS DISTINCT FROM OLD.delivery_days THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Rok isporuke', OLD.delivery_days::text, NEW.delivery_days::text);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Napomena', OLD.notes, NEW.notes);
  END IF;
  IF NEW.terrain_visits_count IS DISTINCT FROM OLD.terrain_visits_count THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Broj izlazaka na teren', OLD.terrain_visits_count::text, NEW.terrain_visits_count::text);
  END IF;
  IF NEW.install_address IS DISTINCT FROM OLD.install_address THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Adresa montaže', OLD.install_address, NEW.install_address);
  END IF;
  IF NEW.delivery_address IS DISTINCT FROM OLD.delivery_address THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, field_name, old_value, new_value)
    VALUES (NEW.id, v_uid, 'quote_updated', 'quote', NEW.id, 'Adresa dostave', OLD.delivery_address, NEW.delivery_address);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quotes_log_change
  AFTER UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_quote_change();

CREATE OR REPLACE FUNCTION public.fn_log_quote_item_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, details)
    VALUES (NEW.quote_id, v_uid, 'item_added', 'quote_item', NEW.id, NEW.name,
            jsonb_build_object('quantity', NEW.quantity, 'unit_price', NEW.unit_price, 'line_total', NEW.line_total));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, details)
    VALUES (OLD.quote_id, v_uid, 'item_deleted', 'quote_item', OLD.id, OLD.name,
            jsonb_build_object('quantity', OLD.quantity, 'unit_price', OLD.unit_price, 'line_total', OLD.line_total));
    RETURN OLD;
  END IF;

  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Količina', OLD.quantity::text, NEW.quantity::text);
  END IF;
  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Jedinična cena', OLD.unit_price::text, NEW.unit_price::text);
  END IF;
  IF NEW.custom_price IS DISTINCT FROM OLD.custom_price THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Custom cena', OLD.custom_price::text, NEW.custom_price::text);
  END IF;
  IF NEW.markup_percent IS DISTINCT FROM OLD.markup_percent THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Marža (%)', OLD.markup_percent::text, NEW.markup_percent::text);
  END IF;
  IF NEW.cost_per_m2 IS DISTINCT FROM OLD.cost_per_m2 THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Cena/m²', OLD.cost_per_m2::text, NEW.cost_per_m2::text);
  END IF;
  IF NEW.material_id IS DISTINCT FROM OLD.material_id OR NEW.material_name IS DISTINCT FROM OLD.material_name THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Materijal', OLD.material_name, NEW.material_name);
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Naziv', OLD.name, NEW.name);
  END IF;
  IF NEW.finishing_cost IS DISTINCT FROM OLD.finishing_cost THEN
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, field_name, old_value, new_value)
    VALUES (NEW.quote_id, v_uid, 'item_updated', 'quote_item', NEW.id, NEW.name, 'Dorada (cena)', OLD.finishing_cost::text, NEW.finishing_cost::text);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quote_items_log_change
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_quote_item_change();

CREATE OR REPLACE FUNCTION public.fn_log_quote_collaborator_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, new_value)
    VALUES (NEW.quote_id, v_uid, 'collaborator_added', 'collaborator', NEW.user_id, 'Kolaborator', COALESCE(v_name, NEW.user_id::text));
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = OLD.user_id;
    INSERT INTO public.quote_activities(quote_id, user_id, action, entity_type, entity_id, item_name, old_value)
    VALUES (OLD.quote_id, v_uid, 'collaborator_removed', 'collaborator', OLD.user_id, 'Kolaborator', COALESCE(v_name, OLD.user_id::text));
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_quote_collaborators_log_change
  AFTER INSERT OR DELETE ON public.quote_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_quote_collaborator_change();

-- ============================================================================
-- duplicate_quote RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id UUID, p_as_new_version BOOLEAN DEFAULT false)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_new_id UUID; v_root_id UUID; v_max_rev INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF p_as_new_version THEN
    SELECT COALESCE(parent_quote_id, id) INTO v_root_id
      FROM public.quotes WHERE id = p_quote_id;
    SELECT COALESCE(MAX(revision_number), 0) INTO v_max_rev
      FROM public.quotes WHERE id = v_root_id OR parent_quote_id = v_root_id;
  END IF;

  INSERT INTO public.quotes (
    client_id, status, total_price, discount_percent, final_price,
    valid_days, payment_terms, delivery_days, notes, internal_notes,
    default_markup_percent, terrain_visits_count, terrain_visit_price_eur,
    terrain_visits_cost, install_address, install_date, install_time,
    install_contact, install_phone, install_notes, delivery_address,
    delivery_date, delivery_time, delivery_contact, delivery_phone,
    delivery_notes, exchange_rate_used, created_by,
    parent_quote_id, revision_number
  )
  SELECT
    client_id, 'draft', total_price, discount_percent, final_price,
    valid_days, payment_terms, delivery_days, notes, internal_notes,
    default_markup_percent, terrain_visits_count, terrain_visit_price_eur,
    terrain_visits_cost, install_address, install_date, install_time,
    install_contact, install_phone, install_notes, delivery_address,
    delivery_date, delivery_time, delivery_contact, delivery_phone,
    delivery_notes, exchange_rate_used, v_uid,
    CASE WHEN p_as_new_version THEN v_root_id ELSE NULL END,
    CASE WHEN p_as_new_version THEN v_max_rev + 1 ELSE 1 END
  FROM public.quotes WHERE id = p_quote_id
  RETURNING id INTO v_new_id;

  INSERT INTO public.quote_items (
    quote_id, item_type, name, description, quantity, width_mm, height_mm,
    pages, print_sides, paper_type, paper_gsm, sheet_format, material_id,
    material_name, area_m2, service_id, service_name, unit_cost, unit_price,
    custom_price, line_total, supplier_name, supplier_price, cost_per_m2,
    finishing_cost, markup_percent, source_category, min_qty_per_order,
    yearly_qty, order_index, toner_cost_per_m2_eur,
    installation_standard_enabled, installation_price_per_m2,
    installation_fixed_start, installation_high_enabled,
    installation_high_price_per_m2, installation_high_fixed_start,
    installation_cost, finishing_enabled, finishing_grommets,
    finishing_weld_edges, finishing_sleeve, finishing_joining,
    finishing_lamination, finishing_cutting, finishing_creasing,
    finishing_ruter, finishing_v_cut, finishing_kasiranje,
    finishing_lepljenje, finishing_notes, sheet_finishing_enabled,
    sf_cutting, sf_creasing, sf_folding, sf_perforation, sf_hole_punching,
    sf_stapling, sf_spiral_binding, sf_thermal_binding, sf_thread_sewing,
    sf_hardcover, sf_softcover, sf_numbering, sf_block_gluing, sf_lamination,
    sf_uv_partial, sf_uv_full, sf_die_cutting, sf_grommets, sf_mounting,
    sf_gold_foil, sheet_finishing_notes, digital_spec, billable_qty, billable_unit
  )
  SELECT
    v_new_id, item_type, name, description, quantity, width_mm, height_mm,
    pages, print_sides, paper_type, paper_gsm, sheet_format, material_id,
    material_name, area_m2, service_id, service_name, unit_cost, unit_price,
    custom_price, line_total, supplier_name, supplier_price, cost_per_m2,
    finishing_cost, markup_percent, source_category, min_qty_per_order,
    yearly_qty, order_index, toner_cost_per_m2_eur,
    installation_standard_enabled, installation_price_per_m2,
    installation_fixed_start, installation_high_enabled,
    installation_high_price_per_m2, installation_high_fixed_start,
    installation_cost, finishing_enabled, finishing_grommets,
    finishing_weld_edges, finishing_sleeve, finishing_joining,
    finishing_lamination, finishing_cutting, finishing_creasing,
    finishing_ruter, finishing_v_cut, finishing_kasiranje,
    finishing_lepljenje, finishing_notes, sheet_finishing_enabled,
    sf_cutting, sf_creasing, sf_folding, sf_perforation, sf_hole_punching,
    sf_stapling, sf_spiral_binding, sf_thermal_binding, sf_thread_sewing,
    sf_hardcover, sf_softcover, sf_numbering, sf_block_gluing, sf_lamination,
    sf_uv_partial, sf_uv_full, sf_die_cutting, sf_grommets, sf_mounting,
    sf_gold_foil, sheet_finishing_notes, digital_spec, billable_qty, billable_unit
  FROM public.quote_items WHERE quote_id = p_quote_id;

  IF p_as_new_version THEN
    UPDATE public.quotes
       SET status = 'superseded', updated_at = now()
     WHERE id = p_quote_id AND status IN ('sent','rejected','expired');
  END IF;

  RETURN v_new_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.duplicate_quote(UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- RLS Policies (final state)
-- ============================================================================

-- quotes
CREATE POLICY "Superuser, owners and collaborators can view quotes"
  ON public.quotes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'superuser'::app_role)
    OR created_by = auth.uid()
    OR public.is_quote_collaborator(id, auth.uid())
  );

CREATE POLICY "Admins and superusers can create quotes"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role]));

CREATE POLICY "Admins, owners and collaborators can update quotes"
  ON public.quotes FOR UPDATE TO authenticated
  USING (
    has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role])
    OR created_by = auth.uid()
    OR public.is_quote_collaborator(id, auth.uid())
  );

CREATE POLICY "Only superuser can delete quotes"
  ON public.quotes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'superuser'::app_role));

-- quote_items
CREATE POLICY "Authenticated users can view quote items"
  ON public.quote_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
        AND (
          has_role(auth.uid(), 'superuser'::app_role)
          OR q.created_by = auth.uid()
          OR public.is_quote_collaborator(q.id, auth.uid())
        )
    )
  );

CREATE POLICY "Admins, owners and collaborators can manage quote items"
  ON public.quote_items FOR ALL TO authenticated
  USING (
    has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role])
    OR EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
        AND (q.created_by = auth.uid() OR public.is_quote_collaborator(q.id, auth.uid()))
    )
  )
  WITH CHECK (
    has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role])
    OR EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
        AND (q.created_by = auth.uid() OR public.is_quote_collaborator(q.id, auth.uid()))
    )
  );

-- quote_collaborators
CREATE POLICY "View collaborators of accessible quotes"
  ON public.quote_collaborators FOR SELECT TO authenticated
  USING (
    has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role])
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.created_by = auth.uid())
  );

CREATE POLICY "Owner or admin can add collaborators"
  ON public.quote_collaborators FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role])
    OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.created_by = auth.uid())
  );

CREATE POLICY "Owner or admin can remove collaborators"
  ON public.quote_collaborators FOR DELETE TO authenticated
  USING (
    has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role])
    OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.created_by = auth.uid())
  );

-- quote_activities
CREATE POLICY "View activities for accessible quotes"
  ON public.quote_activities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_activities.quote_id
        AND (
          q.created_by = auth.uid()
          OR public.is_quote_collaborator(q.id, auth.uid())
          OR public.has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role, 'admin_plus'::app_role])
        )
    )
  );

CREATE POLICY "Insert activities for accessible quotes"
  ON public.quote_activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- quote_expiry_notifications
CREATE POLICY "Authenticated can read expiry notifications"
  ON public.quote_expiry_notifications FOR SELECT TO authenticated
  USING (true);