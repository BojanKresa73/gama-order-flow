-- Drop existing INSERT policies for large_format_orders
DROP POLICY IF EXISTS "Operators and admins can create large format orders" ON public.large_format_orders;

-- Create updated INSERT policy that includes superuser
CREATE POLICY "Operators and admins can create large format orders" 
ON public.large_format_orders 
FOR INSERT 
WITH CHECK (
  current_user_is_active() AND 
  (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role, 'operator'::app_role]))
);

-- Drop existing UPDATE policies for large_format_orders
DROP POLICY IF EXISTS "Operators and admins can update large format orders" ON public.large_format_orders;

-- Create updated UPDATE policy that includes superuser
CREATE POLICY "Operators and admins can update large format orders" 
ON public.large_format_orders 
FOR UPDATE 
USING (
  current_user_is_active() AND 
  (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role, 'operator'::app_role]))
);

-- Drop existing INSERT policies for large_format_jobs
DROP POLICY IF EXISTS "Operators and admins can create large format jobs" ON public.large_format_jobs;

-- Create updated INSERT policy that includes superuser
CREATE POLICY "Operators and admins can create large format jobs" 
ON public.large_format_jobs 
FOR INSERT 
WITH CHECK (
  current_user_is_active() AND 
  (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role, 'operator'::app_role]))
);

-- Drop existing UPDATE policies for large_format_jobs
DROP POLICY IF EXISTS "Operators and admins can update large format jobs" ON public.large_format_jobs;

-- Create updated UPDATE policy that includes superuser
CREATE POLICY "Operators and admins can update large format jobs" 
ON public.large_format_jobs 
FOR UPDATE 
USING (
  current_user_is_active() AND 
  (current_user_role() = ANY (ARRAY['superuser'::app_role, 'admin'::app_role, 'operator'::app_role]))
);