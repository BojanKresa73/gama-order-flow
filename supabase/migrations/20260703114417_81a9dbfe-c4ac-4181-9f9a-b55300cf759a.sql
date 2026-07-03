
CREATE TABLE public.quick_calc_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quick_calc_history_user_created ON public.quick_calc_history (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_calc_history TO authenticated;
GRANT ALL ON public.quick_calc_history TO service_role;

ALTER TABLE public.quick_calc_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quick calc history"
  ON public.quick_calc_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quick calc history"
  ON public.quick_calc_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick calc history"
  ON public.quick_calc_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
