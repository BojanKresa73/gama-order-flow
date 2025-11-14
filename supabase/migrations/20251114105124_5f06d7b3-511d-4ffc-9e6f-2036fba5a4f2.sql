-- Create saved_reports table
CREATE TABLE IF NOT EXISTS public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ctp', 'digital', 'film')),
  filters JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports and public reports
CREATE POLICY "Users can view own and public reports"
ON public.saved_reports
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR is_public = true
);

-- Users can create their own reports
CREATE POLICY "Users can create own reports"
ON public.saved_reports
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own reports
CREATE POLICY "Users can update own reports"
ON public.saved_reports
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own reports
CREATE POLICY "Users can delete own reports"
ON public.saved_reports
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_saved_reports_user_type ON public.saved_reports(user_id, type);
CREATE INDEX idx_saved_reports_type_public ON public.saved_reports(type, is_public);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();