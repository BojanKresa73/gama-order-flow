-- Ažuriranje close_film_work_order da postavlja closed_by
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
  SELECT order_type INTO v_order_type
  FROM work_orders
  WHERE id = p_work_order_id;
  
  IF v_order_type != 'film' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ova funkcija je samo za filmske naloge');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM work_orders 
    WHERE id = p_work_order_id AND status = 'open'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Radni nalog nije pronađen ili je već zatvoren');
  END IF;

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

  UPDATE work_orders
  SET 
    status = 'closed', 
    closed_at = now(), 
    closed_by = p_user_id,
    updated_at = now()
  WHERE id = p_work_order_id;

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

-- Ažuriranje close_digital_work_order da postavlja closed_by
CREATE OR REPLACE FUNCTION public.close_digital_work_order(p_work_order_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invalid_jobs INTEGER;
  v_order_type TEXT;
BEGIN
  SELECT order_type INTO v_order_type
  FROM work_orders
  WHERE id = p_work_order_id;
  
  IF v_order_type != 'digital' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ova funkcija je samo za digitalne naloge');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM work_orders 
    WHERE id = p_work_order_id AND status = 'open'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Radni nalog nije pronađen ili je već zatvoren');
  END IF;

  -- Auto-calculate computed values for items missing them
  UPDATE digital_jobs 
  SET 
    computed_total_sheets = obim * qty,
    computed_color_clicks = CASE 
      WHEN print_sides IN ('4/0', '4/4', '4/1') THEN 
        obim * qty * (CASE 
          WHEN print_sides = '4/0' THEN 1 
          WHEN print_sides = '4/4' THEN 2 
          WHEN print_sides = '4/1' THEN 1 
          ELSE 0 
        END) * (CASE WHEN machine_sheet_format = '760x330' THEN 1.5 ELSE 1.0 END)
      ELSE 0 
    END,
    computed_mono_clicks = CASE 
      WHEN print_sides IN ('1/0', '1/1', '4/1') THEN 
        obim * qty * (CASE 
          WHEN print_sides = '1/0' THEN 1 
          WHEN print_sides = '1/1' THEN 2 
          WHEN print_sides = '4/1' THEN 1 
          ELSE 0 
        END) * (CASE WHEN machine_sheet_format = '760x330' THEN 1.5 ELSE 1.0 END)
      ELSE 0 
    END,
    updated_at = now()
  WHERE work_order_id = p_work_order_id
    AND (computed_total_sheets IS NULL OR computed_total_sheets <= 0);

  -- Check again after recalculation
  SELECT COUNT(*) INTO v_invalid_jobs
  FROM digital_jobs
  WHERE work_order_id = p_work_order_id
    AND (computed_total_sheets IS NULL OR computed_total_sheets <= 0);
  
  IF v_invalid_jobs > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Popunite sve stavke (format/strane/količina). ' || v_invalid_jobs || ' stavki nemaju izračunate vrednosti.'
    );
  END IF;

  UPDATE work_orders
  SET 
    status = 'closed', 
    closed_at = now(), 
    closed_by = p_user_id,
    updated_at = now()
  WHERE id = p_work_order_id;

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
      'order_type', 'digital'
    )
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;