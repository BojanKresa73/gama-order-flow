
-- Update price_list_digital policies - only superuser can manage
DROP POLICY IF EXISTS "Admins can manage paper types" ON public.price_list_digital;
CREATE POLICY "Only superuser can manage price list"
ON public.price_list_digital
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Update digital_settings policies - only superuser can manage
DROP POLICY IF EXISTS "Admins can manage digital settings" ON public.digital_settings;
CREATE POLICY "Only superuser can manage digital settings"
ON public.digital_settings
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Update film_settings policies - only superuser can manage
DROP POLICY IF EXISTS "Admins can manage film settings" ON public.film_settings;
CREATE POLICY "Only superuser can manage film settings"
ON public.film_settings
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Update digital_paper_types policies - only superuser can manage
DROP POLICY IF EXISTS "Admins can manage paper types" ON public.digital_paper_types;
CREATE POLICY "Only superuser can manage paper types"
ON public.digital_paper_types
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Update user_roles policies - only superuser can manage
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
CREATE POLICY "Only superuser can manage roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Update checklist_templates policies - only superuser can manage
DROP POLICY IF EXISTS "Admins can manage templates" ON public.checklist_templates;
CREATE POLICY "Only superuser can manage templates"
ON public.checklist_templates
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Update checklist_template_items policies - only superuser can manage
DROP POLICY IF EXISTS "Admins can manage template items" ON public.checklist_template_items;
CREATE POLICY "Only superuser can manage template items"
ON public.checklist_template_items
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Update work_orders update policy - admin cannot edit closed orders
DROP POLICY IF EXISTS "wo_update_all" ON public.work_orders;
CREATE POLICY "wo_update_all"
ON public.work_orders
FOR UPDATE
USING (
  current_user_is_active() 
  AND (deleted_at IS NULL) 
  AND (
    (current_user_role() = 'superuser'::app_role)
    OR ((current_user_role() = 'admin'::app_role) AND (status = 'open'::work_order_status))
    OR ((current_user_role() = 'operator'::app_role) AND (status = 'open'::work_order_status))
    OR ((current_user_role() = 'operator_ctp'::app_role) AND (status = 'open'::work_order_status))
  )
)
WITH CHECK (
  current_user_is_active() 
  AND (
    (current_user_role() = 'superuser'::app_role)
    OR ((current_user_role() = 'admin'::app_role) AND (status = 'open'::work_order_status))
    OR (current_user_role() = 'operator'::app_role)
    OR ((current_user_role() = 'operator_ctp'::app_role) AND (status = 'closed'::work_order_status) AND (closed_by = auth.uid()) AND (closed_at IS NOT NULL))
  )
);

-- Update admin RPC functions to only allow superuser
CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT ''::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, email text, full_name text, role app_role, is_active boolean, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superuser can list users
  IF NOT has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Access denied: superuser role required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    u.email::text,
    p.full_name,
    ur.role,
    p.is_active,
    p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE 
    p_search = '' 
    OR u.email ILIKE '%' || p_search || '%'
    OR p.full_name ILIKE '%' || p_search || '%'
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superuser can set roles
  IF NOT has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Access denied: superuser role required';
  END IF;

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = p_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_active(p_user_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superuser can set active status
  IF NOT has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Access denied: superuser role required';
  END IF;

  UPDATE profiles SET is_active = p_active WHERE id = p_user_id;
END;
$$;
