-- Fix profiles table RLS policies to restrict access
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create restricted SELECT policy: users see their own, admins/superusers see all
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'superuser'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create UPDATE policy: users can only update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create INSERT policy for new user registration (profile creation)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);