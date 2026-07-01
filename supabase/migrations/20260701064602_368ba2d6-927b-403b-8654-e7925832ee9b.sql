
-- ENUM
DO $$ BEGIN
  CREATE TYPE public.vacation_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SETTINGS (singleton)
CREATE TABLE public.vacation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  annual_days int NOT NULL DEFAULT 21,
  min_notice_days int NOT NULL DEFAULT 7,
  carryover_deadline_month int NOT NULL DEFAULT 6,
  carryover_deadline_day int NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vacation_settings TO authenticated;
GRANT ALL ON public.vacation_settings TO service_role;
ALTER TABLE public.vacation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.vacation_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "superuser writes settings" ON public.vacation_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superuser')) WITH CHECK (public.has_role(auth.uid(),'superuser'));
INSERT INTO public.vacation_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- HOLIDAYS
CREATE TABLE public.vacation_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vacation_holidays TO authenticated;
GRANT ALL ON public.vacation_holidays TO service_role;
ALTER TABLE public.vacation_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read holidays" ON public.vacation_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "superuser manages holidays" ON public.vacation_holidays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superuser')) WITH CHECK (public.has_role(auth.uid(),'superuser'));

-- REQUESTS
CREATE TABLE public.vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count int NOT NULL,
  used_from_previous int NOT NULL DEFAULT 0,
  used_from_current int NOT NULL DEFAULT 0,
  status public.vacation_status NOT NULL DEFAULT 'pending',
  reason text,
  reviewer_id uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX ON public.vacation_requests (user_id, start_date);
CREATE INDEX ON public.vacation_requests (status);
GRANT SELECT, INSERT, UPDATE ON public.vacation_requests TO authenticated;
GRANT ALL ON public.vacation_requests TO service_role;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal reads requests" ON public.vacation_requests FOR SELECT TO authenticated
  USING (NOT public.is_client_portal_user());
CREATE POLICY "user inserts own request" ON public.vacation_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_client_portal_user());
CREATE POLICY "user cancels own pending" ON public.vacation_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status IN ('pending','cancelled'));

CREATE TRIGGER trg_vac_req_updated BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BALANCES
CREATE TABLE public.vacation_balances (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year int NOT NULL,
  allocated int NOT NULL DEFAULT 21,
  used int NOT NULL DEFAULT 0,
  carried_over int NOT NULL DEFAULT 0,
  carryover_expires_on date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year)
);
GRANT SELECT ON public.vacation_balances TO authenticated;
GRANT ALL ON public.vacation_balances TO service_role;
ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own balance or admin plus" ON public.vacation_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_admin_plus_access(auth.uid()));

-- HELPERS
CREATE OR REPLACE FUNCTION public.vacation_count_days(p_start date, p_end date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, (p_end - p_start + 1)) -
    COALESCE((SELECT count(*)::int FROM public.vacation_holidays
              WHERE is_active AND holiday_date BETWEEN p_start AND p_end), 0);
$$;

-- BALANCE ENSURE
CREATE OR REPLACE FUNCTION public.vacation_ensure_balance(p_user uuid, p_year int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_annual int; v_prev_remaining int; v_deadline date;
BEGIN
  SELECT annual_days INTO v_annual FROM public.vacation_settings WHERE id;
  IF NOT EXISTS (SELECT 1 FROM public.vacation_balances WHERE user_id=p_user AND year=p_year) THEN
    SELECT GREATEST(0, allocated + carried_over - used) INTO v_prev_remaining
      FROM public.vacation_balances WHERE user_id=p_user AND year=p_year-1;
    v_deadline := make_date(p_year, 6, 30);
    INSERT INTO public.vacation_balances(user_id, year, allocated, used, carried_over, carryover_expires_on)
    VALUES (p_user, p_year, v_annual, 0, COALESCE(v_prev_remaining,0), v_deadline);
  END IF;
END $$;

-- SUBMIT
CREATE OR REPLACE FUNCTION public.vacation_submit(p_start date, p_end date, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_notice int;
  v_days int;
  v_year int := extract(year from p_start)::int;
  v_bal record;
  v_use_prev int := 0;
  v_use_cur int := 0;
  v_req_id uuid;
  v_carry_valid boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Nema prijavljenog korisnika'; END IF;
  IF public.is_client_portal_user() THEN RAISE EXCEPTION 'Nedozvoljeno'; END IF;
  IF p_end < p_start THEN RAISE EXCEPTION 'Neispravan opseg datuma'; END IF;

  SELECT min_notice_days INTO v_notice FROM public.vacation_settings WHERE id;
  IF p_start < (current_date + v_notice) THEN
    RAISE EXCEPTION 'Godišnji morate najaviti najmanje % dana ranije', v_notice;
  END IF;

  v_days := public.vacation_count_days(p_start, p_end);
  IF v_days <= 0 THEN RAISE EXCEPTION 'Broj dana mora biti veći od 0'; END IF;

  PERFORM public.vacation_ensure_balance(v_user, v_year);
  SELECT * INTO v_bal FROM public.vacation_balances WHERE user_id=v_user AND year=v_year;

  v_carry_valid := v_bal.carryover_expires_on IS NULL OR p_start <= v_bal.carryover_expires_on;
  IF v_carry_valid THEN
    v_use_prev := LEAST(v_bal.carried_over, v_days);
  END IF;
  v_use_cur := v_days - v_use_prev;

  IF v_use_cur > (v_bal.allocated - v_bal.used) THEN
    RAISE EXCEPTION 'Nemate dovoljno preostalih dana (traženo % / dostupno %)',
      v_days, v_bal.allocated - v_bal.used + (CASE WHEN v_carry_valid THEN v_bal.carried_over ELSE 0 END);
  END IF;

  INSERT INTO public.vacation_requests(user_id, start_date, end_date, days_count, used_from_previous, used_from_current, reason)
  VALUES (v_user, p_start, p_end, v_days, v_use_prev, v_use_cur, p_reason)
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END $$;

-- REVIEW
CREATE OR REPLACE FUNCTION public.vacation_review(p_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.has_admin_plus_access(auth.uid()) THEN
    RAISE EXCEPTION 'Samo Admin Plus / Superuser može da odlučuje';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Neispravna odluka';
  END IF;

  SELECT * INTO r FROM public.vacation_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zahtev nije pronađen'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Zahtev nije u statusu na čekanju'; END IF;

  UPDATE public.vacation_requests
    SET status = p_decision::public.vacation_status,
        reviewer_id = auth.uid(),
        reviewed_at = now(),
        reviewer_note = p_note
    WHERE id = p_id;

  IF p_decision = 'approved' THEN
    PERFORM public.vacation_ensure_balance(r.user_id, extract(year from r.start_date)::int);
    UPDATE public.vacation_balances
      SET used = used + r.used_from_current,
          carried_over = GREATEST(0, carried_over - r.used_from_previous),
          updated_at = now()
      WHERE user_id = r.user_id AND year = extract(year from r.start_date)::int;
  END IF;
END $$;

-- SEED HOLIDAYS RS 2026 i 2027
INSERT INTO public.vacation_holidays (holiday_date, name) VALUES
  ('2026-01-01','Nova godina'),
  ('2026-01-02','Nova godina'),
  ('2026-01-07','Božić'),
  ('2026-02-15','Sretenje'),
  ('2026-02-16','Sretenje'),
  ('2026-04-10','Veliki petak'),
  ('2026-04-11','Vaskrs subota'),
  ('2026-04-12','Vaskrs'),
  ('2026-04-13','Vaskrsni ponedeljak'),
  ('2026-05-01','Praznik rada'),
  ('2026-05-02','Praznik rada'),
  ('2026-11-11','Dan primirja'),
  ('2027-01-01','Nova godina'),
  ('2027-01-02','Nova godina'),
  ('2027-01-07','Božić'),
  ('2027-02-15','Sretenje'),
  ('2027-02-16','Sretenje'),
  ('2027-04-30','Veliki petak'),
  ('2027-05-01','Praznik rada / Vaskrs subota'),
  ('2027-05-02','Vaskrs'),
  ('2027-05-03','Vaskrsni ponedeljak'),
  ('2027-11-11','Dan primirja')
ON CONFLICT (holiday_date) DO NOTHING;
