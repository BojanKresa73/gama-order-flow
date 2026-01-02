-- Create helper functions that DON'T reference the new enum value yet
-- These will be updated in a subsequent migration after the enum is committed

-- Helper function to check if user has admin-level access (admin or superuser for now)
CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'superuser')
  )
$$;

-- Helper function for admin_plus access (will include admin_plus once it's committed)
CREATE OR REPLACE FUNCTION public.has_admin_plus_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin_plus', 'superuser')
  )
$$;