-- Prvo obrišimo sve politike koje zavise od view-a
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS wo_select ON work_orders;
DROP POLICY IF EXISTS wo_insert ON work_orders;
DROP POLICY IF EXISTS wo_update ON work_orders;
DROP POLICY IF EXISTS wo_delete ON work_orders;
DROP POLICY IF EXISTS fe_select ON file_entries;
DROP POLICY IF EXISTS fe_insert ON file_entries;
DROP POLICY IF EXISTS fe_update ON file_entries;
DROP POLICY IF EXISTS fe_delete ON file_entries;
DROP POLICY IF EXISTS dn_select ON delivery_notes;
DROP POLICY IF EXISTS dn_insert ON delivery_notes;
DROP POLICY IF EXISTS woe_select ON work_order_events;
DROP POLICY IF EXISTS woe_insert ON work_order_events;

-- Sada možemo obrisati view
DROP VIEW IF EXISTS me CASCADE;

-- Kreiraj security definer funkcije
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_active, true) FROM profiles WHERE id = auth.uid();
$$;

-- PROFILES politike
CREATE POLICY profiles_select ON profiles
FOR SELECT USING (true);

CREATE POLICY profiles_update ON profiles
FOR UPDATE USING (public.current_user_role() = 'superuser');

CREATE POLICY profiles_insert ON profiles
FOR INSERT WITH CHECK (public.current_user_role() = 'superuser');

-- WORK_ORDERS politike
CREATE POLICY wo_select ON work_orders
FOR SELECT USING (public.current_user_is_active());

CREATE POLICY wo_insert ON work_orders
FOR INSERT WITH CHECK (
  public.current_user_is_active() 
  AND public.current_user_role() IN ('superuser','admin','operator')
);

CREATE POLICY wo_update ON work_orders
FOR UPDATE USING (
  public.current_user_is_active()
  AND (
    public.current_user_role() IN ('superuser', 'admin')
    OR (public.current_user_role() = 'operator' AND status = 'open')
    OR (public.current_user_role() = 'operator_ctp' AND status = 'open')
  )
)
WITH CHECK (
  public.current_user_is_active()
  AND (
    public.current_user_role() IN ('superuser', 'admin')
    OR public.current_user_role() = 'operator'
    OR (
      public.current_user_role() = 'operator_ctp' 
      AND status = 'closed'
      AND closed_by = auth.uid()
      AND closed_at IS NOT NULL
    )
  )
);

CREATE POLICY wo_delete ON work_orders
FOR DELETE USING (public.current_user_role() = 'superuser');

-- FILE_ENTRIES politike
CREATE POLICY fe_select ON file_entries
FOR SELECT USING (public.current_user_is_active());

CREATE POLICY fe_insert ON file_entries
FOR INSERT WITH CHECK (public.current_user_role() IN ('superuser','admin','operator'));

CREATE POLICY fe_update ON file_entries
FOR UPDATE USING (public.current_user_role() IN ('superuser','admin','operator'));

CREATE POLICY fe_delete ON file_entries
FOR DELETE USING (public.current_user_role() IN ('superuser'));

-- DELIVERY_NOTES politike
CREATE POLICY dn_select ON delivery_notes
FOR SELECT USING (public.current_user_is_active());

CREATE POLICY dn_insert ON delivery_notes
FOR INSERT WITH CHECK (public.current_user_role() IN ('superuser','admin'));

-- WORK_ORDER_EVENTS politike
CREATE POLICY woe_select ON work_order_events
FOR SELECT USING (public.current_user_is_active());

CREATE POLICY woe_insert ON work_order_events
FOR INSERT WITH CHECK (public.current_user_is_active());