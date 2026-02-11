
-- Table to track CTP job run sessions (start/pause/resume)
CREATE TABLE public.ctp_job_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'stopped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paused_at TIMESTAMPTZ,
  total_active_seconds NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ctp_job_sessions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read ctp_job_sessions"
  ON public.ctp_job_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- All authenticated users can insert
CREATE POLICY "Authenticated users can insert ctp_job_sessions"
  ON public.ctp_job_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can update
CREATE POLICY "Authenticated users can update ctp_job_sessions"
  ON public.ctp_job_sessions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Index for fast lookup
CREATE INDEX idx_ctp_job_sessions_machine_status ON public.ctp_job_sessions(machine_id, status);
CREATE INDEX idx_ctp_job_sessions_work_order ON public.ctp_job_sessions(work_order_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ctp_job_sessions;
