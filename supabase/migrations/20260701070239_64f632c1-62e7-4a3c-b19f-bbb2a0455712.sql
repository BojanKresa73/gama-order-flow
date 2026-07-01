
-- Admin RPC to set carryover for an employee
CREATE OR REPLACE FUNCTION public.vacation_set_carryover(p_user uuid, p_year int, p_carried_over int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_admin_plus_access(auth.uid()) THEN
    RAISE EXCEPTION 'Nedozvoljeno';
  END IF;
  IF p_carried_over < 0 THEN
    RAISE EXCEPTION 'Nevažeća vrednost';
  END IF;
  PERFORM public.vacation_ensure_balance(p_user, p_year);
  UPDATE public.vacation_balances
    SET carried_over = p_carried_over,
        carryover_expires_on = COALESCE(carryover_expires_on, make_date(p_year, 6, 30)),
        updated_at = now()
    WHERE user_id = p_user AND year = p_year;
END $$;

GRANT EXECUTE ON FUNCTION public.vacation_set_carryover(uuid,int,int) TO authenticated;

-- Admin RPC to also set annual allocation (in case someone has different entitlement)
CREATE OR REPLACE FUNCTION public.vacation_set_allocated(p_user uuid, p_year int, p_allocated int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_admin_plus_access(auth.uid()) THEN
    RAISE EXCEPTION 'Nedozvoljeno';
  END IF;
  IF p_allocated < 0 THEN RAISE EXCEPTION 'Nevažeća vrednost'; END IF;
  PERFORM public.vacation_ensure_balance(p_user, p_year);
  UPDATE public.vacation_balances SET allocated = p_allocated, updated_at = now()
    WHERE user_id = p_user AND year = p_year;
END $$;

GRANT EXECUTE ON FUNCTION public.vacation_set_allocated(uuid,int,int) TO authenticated;

-- Ensure balances exist for all internal employees for current year
DO $$
DECLARE r record; v_year int := extract(year from now())::int;
BEGIN
  FOR r IN
    SELECT p.id FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role IS NULL OR ur.role::text <> 'client_user'
  LOOP
    PERFORM public.vacation_ensure_balance(r.id, v_year);
  END LOOP;
END $$;

-- RPC that returns per-employee overview for admin view
CREATE OR REPLACE FUNCTION public.vacation_team_overview(p_year int)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  allocated int,
  carried_over int,
  used int,
  used_from_previous int,
  used_from_current int,
  pending_days int,
  carryover_expires_on date
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_admin_plus_access(auth.uid()) THEN
    RAISE EXCEPTION 'Nedozvoljeno';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name,
    COALESCE(b.allocated, 21),
    COALESCE(b.carried_over, 0),
    COALESCE(b.used, 0),
    COALESCE((SELECT SUM(vr.used_from_previous)::int FROM public.vacation_requests vr
              WHERE vr.user_id = p.id AND vr.status = 'approved'
                AND extract(year from vr.start_date)::int = p_year), 0),
    COALESCE((SELECT SUM(vr.used_from_current)::int FROM public.vacation_requests vr
              WHERE vr.user_id = p.id AND vr.status = 'approved'
                AND extract(year from vr.start_date)::int = p_year), 0),
    COALESCE((SELECT SUM(vr.days_count)::int FROM public.vacation_requests vr
              WHERE vr.user_id = p.id AND vr.status = 'pending'
                AND extract(year from vr.start_date)::int = p_year), 0),
    b.carryover_expires_on
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.vacation_balances b ON b.user_id = p.id AND b.year = p_year
  WHERE ur.role IS NULL OR ur.role::text <> 'client_user'
  ORDER BY p.full_name;
END $$;

GRANT EXECUTE ON FUNCTION public.vacation_team_overview(int) TO authenticated;
