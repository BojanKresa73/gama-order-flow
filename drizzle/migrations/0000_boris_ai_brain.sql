CREATE TABLE public.finance_access_grants (
  user_id uuid PRIMARY KEY,
  note text,
  granted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_access_grants TO authenticated;
GRANT ALL ON public.finance_access_grants TO service_role;
ALTER TABLE public.finance_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grant visible" ON public.finance_access_grants FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.finance_access_grants WHERE user_id = auth.uid())
    AND public.current_user_is_active();
$$;
REVOKE EXECUTE ON FUNCTION public.has_finance_access() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_finance_access() TO authenticated;

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Novi razgovor',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.ai_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.has_finance_access())
  WITH CHECK (user_id = auth.uid() AND public.has_finance_access());

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  tools_used jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.ai_messages FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.has_finance_access())
  WITH CHECK (user_id = auth.uid() AND public.has_finance_access());