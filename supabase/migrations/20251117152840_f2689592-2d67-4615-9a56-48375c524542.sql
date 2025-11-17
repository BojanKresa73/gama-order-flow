-- Create function to atomically increment work order counter
CREATE OR REPLACE FUNCTION public.increment_work_order_counter(
  p_type TEXT,
  p_year INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_serial INTEGER;
BEGIN
  -- Insert new counter if doesn't exist, or increment existing one
  INSERT INTO work_order_counters (type, year, last_serial)
  VALUES (p_type, p_year, 1)
  ON CONFLICT (type, year) 
  DO UPDATE SET last_serial = work_order_counters.last_serial + 1
  RETURNING last_serial INTO v_next_serial;
  
  RETURN v_next_serial;
END;
$$;