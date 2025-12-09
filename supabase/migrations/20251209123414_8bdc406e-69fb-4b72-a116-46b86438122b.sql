-- Drop the restrictive SELECT policies on profiles
DROP POLICY IF EXISTS "Superuser and Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admins all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

-- Create a single policy that allows all authenticated users to view profiles
-- This is appropriate for an internal business application where all users are employees
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);