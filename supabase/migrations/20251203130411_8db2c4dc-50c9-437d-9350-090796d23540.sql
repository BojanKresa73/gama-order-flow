-- Fix close_work_order_atomic: change 'metadata' to 'payload'
CREATE OR REPLACE FUNCTION public.close_work_order_atomic(p_work_order_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Create work order event (using 'payload' column, not 'metadata')
  INSERT INTO work_order_events (
    work_order_id,
    event_type,
    created_by,
    payload
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
$function$;

-- Fix close_film_work_order: change 'metadata' to 'payload'
CREATE OR REPLACE FUNCTION public.close_film_work_order(p_work_order_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Create work order event (using 'payload' column, not 'metadata')
  INSERT INTO work_order_events (
    work_order_id,
    event_type,
    created_by,
    payload
  ) VALUES (
    p_work_order_id,
    'closed',
    p_user_id,
    jsonb_build_object(
      'closed_at', now(),
      'order_type', 'film'
    )
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;