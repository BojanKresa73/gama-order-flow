CREATE TABLE IF NOT EXISTS public.system_maintenance_log (
  id bigserial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  disabled_jobs text[] NOT NULL DEFAULT '{}',
  deleted_job_runs integer NOT NULL DEFAULT 0,
  deleted_http_rows integer NOT NULL DEFAULT 0,
  notes text
);

GRANT SELECT ON public.system_maintenance_log TO authenticated;
GRANT ALL ON public.system_maintenance_log TO service_role;
ALTER TABLE public.system_maintenance_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read maintenance log"
  ON public.system_maintenance_log FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.run_system_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  j record;
  killed text[] := '{}';
  campaign uuid;
  camp_status text;
  runs integer := 0;
  https integer := 0;
BEGIN
  FOR j IN SELECT jobid, jobname, command FROM cron.job WHERE active AND command ILIKE '%send-newsletter-batch%' LOOP
    campaign := NULLIF((regexp_match(j.command, '"campaign_id"\s*:\s*"([0-9a-f-]{36})"'))[1], '')::uuid;
    IF campaign IS NULL THEN
      CONTINUE;
    END IF;
    SELECT status INTO camp_status FROM public.newsletter_campaigns WHERE id = campaign;
    IF camp_status IS NULL OR camp_status <> 'sending' THEN
      PERFORM cron.unschedule(j.jobid);
      killed := killed || j.jobname;
    END IF;
  END LOOP;

  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '2 days';
  GET DIAGNOSTICS runs = ROW_COUNT;

  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '6 hours';
    GET DIAGNOSTICS https = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    https := 0;
  END;

  INSERT INTO public.system_maintenance_log (disabled_jobs, deleted_job_runs, deleted_http_rows)
  VALUES (killed, runs, https);
END;
$$;

REVOKE ALL ON FUNCTION public.run_system_maintenance() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('system-maintenance-guard', '7 * * * *', $$SELECT public.run_system_maintenance();$$);