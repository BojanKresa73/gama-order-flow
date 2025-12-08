-- =====================================================
-- Fix Function Search Path Mutable Issues
-- Add SET search_path = 'public' to all functions missing it
-- =====================================================

-- 1. has_any_role - already has search_path, skip

-- 2. admin_set_user_role - already has search_path, skip

-- 3. admin_set_user_active - already has search_path, skip

-- 4. fn_set_display_order_number - missing search_path, fix it
CREATE OR REPLACE FUNCTION public.fn_set_display_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  n bigint;
  pref text;
begin
  if new.display_order_number is not null then
    return new;
  end if;

  case new.kind
    when 'CTP'         then n := nextval('seq_workorder_ctp');        pref := 'CTP';
    when 'DIGITALA'    then n := nextval('seq_workorder_digitala');   pref := 'DIG';
    when 'FILMOVANJE'  then n := nextval('seq_workorder_filmovanje'); pref := 'FILM';
    when 'RAZNO'       then n := nextval('seq_workorder_razno');      pref := 'RZN';
    when 'ROLNA'       then n := nextval('seq_workorder_rolna');      pref := 'ROL';
    when 'PLOCA'       then n := nextval('seq_workorder_ploca');      pref := 'PLO';
  end case;

  new.display_order_number :=
    pref || '-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(n::text, 6, '0');

  return new;
end$function$;

-- 5. close_digital_work_order - missing search_path, fix it
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

-- 6. close_film_work_order - missing search_path, fix it
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

-- 7. close_work_order_atomic - missing search_path, fix it
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
  SET status = 'closed', closed_at = now(), updated_at = now()
  WHERE id = p_work_order_id AND status = 'open';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order not found or already closed');
  END IF;

  UPDATE file_entries
  SET status = 'closed', updated_at = now()
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

-- 8. get_work_order_full - missing search_path, fix it
CREATE OR REPLACE FUNCTION public.get_work_order_full(p_identifier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare 
  wo jsonb;
begin
  select to_jsonb(w.*) ||
         jsonb_build_object(
           'items',
           case w.order_type
             when 'film' then (
               select coalesce(jsonb_agg(f.*), '[]'::jsonb)
               from film_jobs f where f.work_order_id = w.id
             )
             when 'digital' then (
               select coalesce(jsonb_agg(d.*), '[]'::jsonb)
               from digital_jobs d where d.work_order_id = w.id
             )
             else (
               select coalesce(jsonb_agg(e.*), '[]'::jsonb)
               from file_entries e where e.work_order_id = w.id
             )
           end
         )
    into wo
  from work_orders w
  where (w.id::text = p_identifier or w.display_order_number = p_identifier)
    and w.deleted_at is null;

  if wo is null then
    raise exception 'Work order not found';
  end if;

  return wo;
end $function$;

-- 9. increment_work_order_counter - missing search_path, fix it
CREATE OR REPLACE FUNCTION public.increment_work_order_counter(p_type text, p_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next_serial INTEGER;
BEGIN
  INSERT INTO work_order_counters (type, year, last_serial)
  VALUES (p_type, p_year, 1)
  ON CONFLICT (type, year) 
  DO UPDATE SET last_serial = work_order_counters.last_serial + 1
  RETURNING last_serial INTO v_next_serial;
  
  RETURN v_next_serial;
END;
$function$;

-- 10. generate_order_number - missing search_path, fix it
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.work_orders;
  new_number := 'WO-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$function$;