
-- =====================================================
-- 1. Fix RLS on profiles table - restrict SELECT access
-- =====================================================

-- Drop the current permissive policy
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create strict policies for profiles
-- Regular users can only see their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Superuser and Admin can view all profiles
CREATE POLICY "Superuser and Admin can view all profiles"
ON public.profiles
FOR SELECT
USING (has_any_role(ARRAY['superuser'::app_role, 'admin'::app_role]));

-- =====================================================
-- 2. Fix RLS on email_outbox table - restrict to service role only
-- =====================================================

-- Drop the current permissive policies
DROP POLICY IF EXISTS "System can manage email outbox" ON public.email_outbox;
DROP POLICY IF EXISTS "Admins can view email outbox" ON public.email_outbox;

-- Only superuser can view email outbox (for admin purposes)
-- Service role bypasses RLS entirely, so no policy needed for it
CREATE POLICY "Only superuser can view email outbox"
ON public.email_outbox
FOR SELECT
USING (has_role(auth.uid(), 'superuser'));

-- Only superuser can insert (in practice, service role will do this)
CREATE POLICY "Only superuser can insert email outbox"
ON public.email_outbox
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'superuser'));

-- Only superuser can update (in practice, service role will do this)
CREATE POLICY "Only superuser can update email outbox"
ON public.email_outbox
FOR UPDATE
USING (has_role(auth.uid(), 'superuser'));

-- Only superuser can delete
CREATE POLICY "Only superuser can delete email outbox"
ON public.email_outbox
FOR DELETE
USING (has_role(auth.uid(), 'superuser'));
