-- Ažuriranje close_work_order_atomic funkcije da pravilno postavlja closed_by
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
  UPDATE work_orders
  SET status = 'closed', closed_at = now(), closed_by = p_user_id, updated_at = now()
  WHERE id = p_work_order_id AND status = 'open';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order not found or already closed');
  END IF;

  UPDATE file_entries
  SET status = 'closed', closed_by = p_user_id, closed_at = now(), updated_at = now()
  WHERE work_order_id = p_work_order_id AND status = 'open';

  FOR v_file_record IN
    SELECT fe.plate_format_id, fe.quantity
    FROM file_entries fe
    WHERE fe.work_order_id = p_work_order_id 
      AND fe.status = 'closed'
      AND fe.plate_format_id IS NOT NULL
      AND fe.quantity IS NOT NULL
  LOOP
    UPDATE plate_formats
    SET 
      current_stock = current_stock - v_file_record.quantity,
      low_stock = (current_stock - v_file_record.quantity) < low_stock_threshold,
      updated_at = now()
    WHERE id = v_file_record.plate_format_id;

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