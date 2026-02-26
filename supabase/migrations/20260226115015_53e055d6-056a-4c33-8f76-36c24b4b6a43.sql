
-- 1. In-app notifications for portal users
CREATE TABLE public.portal_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  event_type text NOT NULL, -- 'created', 'closed', 'priority_changed', 'status_changed'
  is_read boolean NOT NULL DEFAULT false,
  read_by uuid REFERENCES auth.users(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;

-- Portal users can see notifications for their client
CREATE POLICY "Portal users can view own client notifications"
  ON public.portal_notifications FOR SELECT
  USING (client_id = public.current_user_client_id());

-- Portal users can mark notifications as read
CREATE POLICY "Portal users can update own client notifications"
  ON public.portal_notifications FOR UPDATE
  USING (client_id = public.current_user_client_id());

-- Internal users can view all notifications
CREATE POLICY "Internal users can view all portal notifications"
  ON public.portal_notifications FOR SELECT
  USING (public.has_any_role(ARRAY['superuser'::app_role, 'admin_plus'::app_role, 'admin'::app_role, 'operator'::app_role, 'operator_ctp'::app_role]));

-- System can insert notifications (from edge functions / triggers)
CREATE POLICY "Internal users can insert portal notifications"
  ON public.portal_notifications FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['superuser'::app_role, 'admin_plus'::app_role, 'admin'::app_role, 'operator'::app_role, 'operator_ctp'::app_role]));

-- 2. Push subscriptions for portal users
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime for portal_notifications so the bell updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_notifications;

-- Create index for fast lookups
CREATE INDEX idx_portal_notifications_client_id ON public.portal_notifications(client_id, is_read, created_at DESC);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
