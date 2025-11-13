-- Add low_stock column to plate_formats
ALTER TABLE plate_formats ADD COLUMN IF NOT EXISTS low_stock boolean DEFAULT false;

-- Create work_order_events table
CREATE TABLE IF NOT EXISTS work_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb
);

-- Enable RLS on work_order_events
ALTER TABLE work_order_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for work_order_events
CREATE POLICY "Authenticated users can view events"
  ON work_order_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert events"
  ON work_order_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create atomic close work order function
CREATE OR REPLACE FUNCTION close_work_order_atomic(
  p_work_order_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_file_record RECORD;
  v_format_record RECORD;
BEGIN
  -- Update work order status to closed
  UPDATE work_orders
  SET status = 'closed', closed_at = now(), updated_at = now()
  WHERE id = p_work_order_id AND status = 'open';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order not found or already closed');
  END IF;

  -- Close all file entries
  UPDATE file_entries
  SET status = 'closed', updated_at = now()
  WHERE work_order_id = p_work_order_id AND status = 'open';

  -- Process CTP files - reduce stock
  FOR v_file_record IN
    SELECT fe.plate_format_id, fe.quantity
    FROM file_entries fe
    WHERE fe.work_order_id = p_work_order_id 
      AND fe.status = 'closed'
      AND fe.plate_format_id IS NOT NULL
      AND fe.quantity IS NOT NULL
  LOOP
    -- Update stock
    UPDATE plate_formats
    SET 
      current_stock = current_stock - v_file_record.quantity,
      low_stock = (current_stock - v_file_record.quantity) < low_stock_threshold,
      updated_at = now()
    WHERE id = v_file_record.plate_format_id;

    -- Log inventory change
    INSERT INTO inventory_history (
      plate_format_id,
      change_amount,
      work_order_id,
      created_by,
      reason
    ) VALUES (
      v_file_record.plate_format_id,
      -v_file_record.quantity,
      p_work_order_id,
      p_user_id,
      'Work order closed'
    );
  END LOOP;

  -- Create work order event
  INSERT INTO work_order_events (
    work_order_id,
    event_type,
    created_by,
    metadata
  ) VALUES (
    p_work_order_id,
    'closed',
    p_user_id,
    jsonb_build_object('closed_at', now())
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;