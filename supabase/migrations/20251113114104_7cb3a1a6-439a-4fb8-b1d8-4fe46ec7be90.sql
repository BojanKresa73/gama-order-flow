-- Create function to close film work orders with validation
CREATE OR REPLACE FUNCTION public.close_film_work_order(p_work_order_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invalid_jobs INTEGER;
  v_order_type TEXT;
BEGIN
  -- Check if this is actually a film order
  SELECT order_type INTO v_order_type
  FROM work_orders
  WHERE id = p_work_order_id;
  
  IF v_order_type != 'film' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ova funkcija je samo za filmske naloge');
  END IF;
  
  -- Check if order exists and is open
  IF NOT EXISTS (
    SELECT 1 FROM work_orders 
    WHERE id = p_work_order_id AND status = 'open'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Radni nalog nije pronađen ili je već zatvoren');
  END IF;

  -- Check if all film jobs have computed_total_m > 0
  SELECT COUNT(*) INTO v_invalid_jobs
  FROM film_jobs
  WHERE work_order_id = p_work_order_id
    AND (computed_total_m IS NULL OR computed_total_m <= 0);
  
  IF v_invalid_jobs > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Ne mogu zatvoriti nalog: ' || v_invalid_jobs || ' stavki nema izračunatu dužinu (computed_total_m). Proverite sve stavke filmovanja.'
    );
  END IF;

  -- Update work order status to closed
  UPDATE work_orders
  SET 
    status = 'closed', 
    closed_at = now(), 
    updated_at = now()
  WHERE id = p_work_order_id;

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
    jsonb_build_object(
      'closed_at', now(),
      'order_type', 'film'
    )
  );

  -- Hook for future inventory deduction (currently not implemented)
  -- TODO: Add inventory deduction logic here when needed

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;