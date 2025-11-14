-- Helper view: tekući korisnik sa rolom iz user_roles
CREATE OR REPLACE VIEW me AS
SELECT 
  u.id as user_id, 
  ur.role as app_role,
  COALESCE(p.is_active, true) as is_active
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN profiles p ON p.id = u.id
WHERE u.id = auth.uid();

-- PROFILES RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;

CREATE POLICY profiles_select ON profiles
FOR SELECT USING (true);

CREATE POLICY profiles_update ON profiles
FOR UPDATE USING (
  EXISTS(SELECT 1 FROM me WHERE me.user_id = auth.uid() AND me.app_role = 'superuser')
);

CREATE POLICY profiles_insert ON profiles
FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM me WHERE me.user_id = auth.uid() AND me.app_role = 'superuser')
);

-- WORK_ORDERS RLS
DROP POLICY IF EXISTS "Authenticated users can view orders" ON work_orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON work_orders;
DROP POLICY IF EXISTS "Operators and admins can update orders" ON work_orders;
DROP POLICY IF EXISTS "Only admins can delete orders" ON work_orders;
DROP POLICY IF EXISTS wo_select ON work_orders;
DROP POLICY IF EXISTS wo_insert ON work_orders;
DROP POLICY IF EXISTS wo_update ON work_orders;
DROP POLICY IF EXISTS wo_delete ON work_orders;

CREATE POLICY wo_select ON work_orders
FOR SELECT USING (
  EXISTS(SELECT 1 FROM me WHERE is_active)
);

CREATE POLICY wo_insert ON work_orders
FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM me WHERE is_active AND me.app_role IN ('superuser','admin','operator'))
);

-- UPDATE politika: podeljeno na USING (OLD) i WITH CHECK (NEW)
CREATE POLICY wo_update ON work_orders
FOR UPDATE USING (
  EXISTS(
    SELECT 1 FROM me 
    WHERE is_active 
    AND (
      -- superuser i admin mogu sve
      me.app_role IN ('superuser', 'admin')
      -- operator može ako nije već zatvoren
      OR (me.app_role = 'operator' AND status = 'open')
      -- operator_ctp samo može zatvoriti otvorene
      OR (me.app_role = 'operator_ctp' AND status = 'open')
    )
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM me 
    WHERE is_active 
    AND (
      -- superuser i admin mogu sve
      me.app_role IN ('superuser', 'admin')
      -- operator može zatvoriti ili menjati otvorene
      OR (me.app_role = 'operator')
      -- operator_ctp samo može setovati status na closed sa svojim ID-om
      OR (
        me.app_role = 'operator_ctp' 
        AND status = 'closed'
        AND closed_by = auth.uid()
        AND closed_at IS NOT NULL
      )
    )
  )
);

CREATE POLICY wo_delete ON work_orders
FOR DELETE USING (
  EXISTS(SELECT 1 FROM me WHERE app_role = 'superuser')
);

-- FILE_ENTRIES RLS
DROP POLICY IF EXISTS "Authenticated users can view file entries" ON file_entries;
DROP POLICY IF EXISTS "Authenticated users can create file entries" ON file_entries;
DROP POLICY IF EXISTS "Operators and admins can update file entries" ON file_entries;
DROP POLICY IF EXISTS "Admins can delete file entries" ON file_entries;
DROP POLICY IF EXISTS fe_select ON file_entries;
DROP POLICY IF EXISTS fe_insert ON file_entries;
DROP POLICY IF EXISTS fe_update ON file_entries;
DROP POLICY IF EXISTS fe_delete ON file_entries;

CREATE POLICY fe_select ON file_entries
FOR SELECT USING (
  EXISTS(SELECT 1 FROM me WHERE is_active)
);

CREATE POLICY fe_insert ON file_entries
FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM me WHERE app_role IN ('superuser','admin','operator'))
);

CREATE POLICY fe_update ON file_entries
FOR UPDATE USING (
  EXISTS(SELECT 1 FROM me WHERE app_role IN ('superuser','admin','operator'))
);

CREATE POLICY fe_delete ON file_entries
FOR DELETE USING (
  EXISTS(SELECT 1 FROM me WHERE app_role IN ('superuser'))
);

-- DELIVERY_NOTES RLS
DROP POLICY IF EXISTS "Only admins and operators can view delivery notes" ON delivery_notes;
DROP POLICY IF EXISTS "System can insert delivery notes" ON delivery_notes;
DROP POLICY IF EXISTS dn_select ON delivery_notes;
DROP POLICY IF EXISTS dn_insert ON delivery_notes;

CREATE POLICY dn_select ON delivery_notes
FOR SELECT USING (
  EXISTS(SELECT 1 FROM me WHERE is_active)
);

CREATE POLICY dn_insert ON delivery_notes
FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM me WHERE app_role IN ('superuser','admin'))
);

-- WORK_ORDER_EVENTS RLS
DROP POLICY IF EXISTS "Authenticated users can view events" ON work_order_events;
DROP POLICY IF EXISTS "Authenticated users can insert events" ON work_order_events;
DROP POLICY IF EXISTS woe_select ON work_order_events;
DROP POLICY IF EXISTS woe_insert ON work_order_events;

CREATE POLICY woe_select ON work_order_events
FOR SELECT USING (
  EXISTS(SELECT 1 FROM me WHERE is_active)
);

CREATE POLICY woe_insert ON work_order_events
FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM me WHERE is_active)
);