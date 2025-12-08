-- =============================================================
-- FIX 1: Work Orders - Restrict SELECT to SUPERUSER/ADMIN or creator
-- =============================================================
DROP POLICY IF EXISTS "wo_select_all_visible" ON public.work_orders;

CREATE POLICY "wo_select_all_visible"
ON public.work_orders
FOR SELECT
USING (
  current_user_is_active() 
  AND deleted_at IS NULL 
  AND (
    current_user_role() IN ('superuser', 'admin')
    OR created_by = auth.uid()
  )
);

-- =============================================================
-- FIX 2: Profiles - Restrict SELECT to own profile or SUPERUSER/ADMIN
-- =============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'superuser'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================================
-- FIX 3: Clients - Restrict SELECT to owner or SUPERUSER/ADMIN
-- =============================================================
DROP POLICY IF EXISTS "Users can view own clients or admins all" ON public.clients;

CREATE POLICY "clients_select"
ON public.clients
FOR SELECT
USING (
  owner_user_id = auth.uid()
  OR has_role(auth.uid(), 'superuser'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);