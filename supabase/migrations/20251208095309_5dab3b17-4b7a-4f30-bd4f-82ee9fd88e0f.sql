
-- =====================================================
-- 1. Fix RLS on user_roles table - require authentication for SELECT
-- =====================================================

-- Drop the current policy that allows public access
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

-- Only authenticated users can view roles
CREATE POLICY "Authenticated users can view roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 2. Fix RLS on work_order_counters table - require authentication
-- =====================================================

-- Drop the current overly permissive policy
DROP POLICY IF EXISTS "Service role can manage counters" ON public.work_order_counters;

-- Only superuser can view counters directly (service role bypasses RLS)
CREATE POLICY "Only superuser can view counters"
ON public.work_order_counters
FOR SELECT
USING (has_role(auth.uid(), 'superuser'));

-- Service role will bypass RLS for insert/update operations
-- For authenticated users with proper roles (superuser only)
CREATE POLICY "Only superuser can manage counters"
ON public.work_order_counters
FOR ALL
USING (has_role(auth.uid(), 'superuser'))
WITH CHECK (has_role(auth.uid(), 'superuser'));
