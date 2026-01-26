-- ============================================
-- PRIORITY MODULE - Complete Database Schema
-- ============================================

-- 1. Add priority column to work_orders
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 5 
CHECK (priority >= 1 AND priority <= 10);

-- Create index for priority sorting
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON public.work_orders(priority DESC, created_at ASC);

-- 2. Create client_portal_users table for external client users
CREATE TABLE public.client_portal_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    phone text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id),
    UNIQUE(client_id, user_id)
);

-- Enable RLS
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_portal_users
CREATE POLICY "Admins can manage client portal users"
ON public.client_portal_users
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('superuser', 'admin_plus', 'admin')
    )
);

CREATE POLICY "Client portal users can view own record"
ON public.client_portal_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Create new role for client portal users
-- First check if the enum value exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'client_user' AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'client_user';
    END IF;
END$$;

-- 4. Create priority_change_log table
CREATE TABLE public.priority_change_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    changed_by uuid NOT NULL,
    changed_by_type text NOT NULL CHECK (changed_by_type IN ('internal', 'client')),
    old_priority integer,
    new_priority integer NOT NULL CHECK (new_priority >= 1 AND new_priority <= 10),
    note text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.priority_change_log ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX idx_priority_change_log_work_order ON public.priority_change_log(work_order_id);
CREATE INDEX idx_priority_change_log_created ON public.priority_change_log(created_at DESC);

-- RLS Policies for priority_change_log
CREATE POLICY "Authenticated users can view priority log"
ON public.priority_change_log
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert priority log"
ON public.priority_change_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Create priority_notifications table
CREATE TABLE public.priority_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_change_log_id uuid NOT NULL REFERENCES public.priority_change_log(id) ON DELETE CASCADE,
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    acknowledged_by uuid REFERENCES auth.users(id),
    acknowledged_at timestamp with time zone,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.priority_notifications ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX idx_priority_notifications_unread ON public.priority_notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_priority_notifications_created ON public.priority_notifications(created_at DESC);

-- RLS Policies for priority_notifications
CREATE POLICY "Internal users can view notifications"
ON public.priority_notifications
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('superuser', 'admin_plus', 'admin', 'operator', 'operator_ctp')
    )
);

CREATE POLICY "Internal users can update notifications"
ON public.priority_notifications
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('superuser', 'admin_plus', 'admin', 'operator', 'operator_ctp')
    )
);

-- 6. Function to check max 2 portal users per client
CREATE OR REPLACE FUNCTION public.check_max_portal_users()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.client_portal_users WHERE client_id = NEW.client_id) >= 2 THEN
        RAISE EXCEPTION 'Maksimalno 2 korisnika portala po klijentu';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_portal_users
BEFORE INSERT ON public.client_portal_users
FOR EACH ROW
EXECUTE FUNCTION public.check_max_portal_users();

-- 7. Function to get current user's client_id (for portal users)
CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT client_id FROM public.client_portal_users WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 8. Function to check if user is client portal user
CREATE OR REPLACE FUNCTION public.is_client_portal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.client_portal_users 
        WHERE user_id = auth.uid() AND is_active = true
    );
$$;

-- 9. RLS policy for client portal users to view their client's work orders
CREATE POLICY "Client portal users can view their client work orders"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
    client_id = public.current_user_client_id()
);

-- 10. RLS policy for client portal users to update priority on open orders
CREATE POLICY "Client portal users can update priority on open orders"
ON public.work_orders
FOR UPDATE
TO authenticated
USING (
    client_id = public.current_user_client_id()
    AND status = 'open'
)
WITH CHECK (
    client_id = public.current_user_client_id()
    AND status = 'open'
);

-- 11. Enable realtime for priority notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.priority_notifications;

-- 12. Function to update priority and log it
CREATE OR REPLACE FUNCTION public.update_work_order_priority(
    p_work_order_id uuid,
    p_new_priority integer,
    p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_priority integer;
    v_client_id uuid;
    v_is_client_user boolean;
    v_changed_by_type text;
    v_log_id uuid;
    v_order_number text;
BEGIN
    -- Check if user is client portal user
    v_is_client_user := public.is_client_portal_user();
    
    IF v_is_client_user THEN
        v_changed_by_type := 'client';
    ELSE
        v_changed_by_type := 'internal';
    END IF;
    
    -- Get current priority and verify access
    SELECT priority, client_id, order_code INTO v_old_priority, v_client_id, v_order_number
    FROM public.work_orders
    WHERE id = p_work_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nalog nije pronađen';
    END IF;
    
    -- For client users, verify they own this client
    IF v_is_client_user AND v_client_id != public.current_user_client_id() THEN
        RAISE EXCEPTION 'Nemate pristup ovom nalogu';
    END IF;
    
    -- Validate priority
    IF p_new_priority < 1 OR p_new_priority > 10 THEN
        RAISE EXCEPTION 'Prioritet mora biti između 1 i 10';
    END IF;
    
    -- Update priority
    UPDATE public.work_orders
    SET priority = p_new_priority, updated_at = now()
    WHERE id = p_work_order_id;
    
    -- Log the change
    INSERT INTO public.priority_change_log (
        work_order_id, changed_by, changed_by_type, old_priority, new_priority, note
    ) VALUES (
        p_work_order_id, auth.uid(), v_changed_by_type, v_old_priority, p_new_priority, p_note
    ) RETURNING id INTO v_log_id;
    
    -- Create notification for internal users (only for client changes)
    IF v_is_client_user THEN
        INSERT INTO public.priority_notifications (
            priority_change_log_id, work_order_id
        ) VALUES (
            v_log_id, p_work_order_id
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'log_id', v_log_id,
        'old_priority', v_old_priority,
        'new_priority', p_new_priority,
        'order_number', v_order_number
    );
END;
$$;

-- 13. Function to acknowledge notification
CREATE OR REPLACE FUNCTION public.acknowledge_priority_notification(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.priority_notifications
    SET 
        acknowledged_by = auth.uid(),
        acknowledged_at = now(),
        is_read = true
    WHERE id = p_notification_id AND is_read = false;
    
    RETURN FOUND;
END;
$$;

-- 14. Function to get unread notifications count
CREATE OR REPLACE FUNCTION public.get_unread_priority_notifications_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::integer 
    FROM public.priority_notifications 
    WHERE is_read = false;
$$;