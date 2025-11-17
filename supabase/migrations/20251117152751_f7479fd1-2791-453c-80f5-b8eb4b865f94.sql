-- Enable RLS on work_order_counters
ALTER TABLE work_order_counters ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage counters (used by edge function)
CREATE POLICY "Service role can manage counters"
  ON work_order_counters
  FOR ALL
  USING (true)
  WITH CHECK (true);