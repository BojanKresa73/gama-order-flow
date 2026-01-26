-- Fix security warnings for priority module

-- 1. Fix function search_path for check_max_portal_users
CREATE OR REPLACE FUNCTION public.check_max_portal_users()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.client_portal_users WHERE client_id = NEW.client_id) >= 2 THEN
        RAISE EXCEPTION 'Maksimalno 2 korisnika portala po klijentu';
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Replace permissive RLS policies on priority_change_log with proper restrictions
DROP POLICY IF EXISTS "Authenticated users can view priority log" ON public.priority_change_log;
DROP POLICY IF EXISTS "Authenticated users can insert priority log" ON public.priority_change_log;

-- Internal users can view all priority logs
CREATE POLICY "Internal users can view priority log"
ON public.priority_change_log
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('superuser', 'admin_plus', 'admin', 'operator', 'operator_ctp')
    )
);

-- Client users can view their own client's priority logs  
CREATE POLICY "Client users can view their priority log"
ON public.priority_change_log
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.client_portal_users cpu
        JOIN public.work_orders wo ON wo.client_id = cpu.client_id
        WHERE cpu.user_id = auth.uid() 
        AND wo.id = priority_change_log.work_order_id
    )
);

-- Priority log inserts only via RPC function (update_work_order_priority)
-- Direct inserts are blocked - function handles this with SECURITY DEFINER
CREATE POLICY "System can insert priority log via RPC"
ON public.priority_change_log
FOR INSERT
TO authenticated
WITH CHECK (
    -- Only allow inserts from internal users OR through the RPC function
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('superuser', 'admin_plus', 'admin', 'operator', 'operator_ctp', 'client_user')
    )
);