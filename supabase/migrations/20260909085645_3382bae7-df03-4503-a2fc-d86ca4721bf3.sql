CREATE OR REPLACE FUNCTION public.run_system_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  j record;
  killed text[] := '{}';
  campaign uuid;
  camp_status text;
  runs integer := 0;
  https integer := 0;
  purged integer := 0;
  n integer := 0;
BEGIN
  -- 1) Stale "sending" campaigns older than 2h -> failed
  UPDATE public.newsletter_campaigns
     SET status = 'failed'
   WHERE status = 'sending'
     AND COALESCE(updated_at, created_at) < now() - interval '2 hours';

  -- 2) Unschedule newsletter batch jobs whose campaign is no longer sending
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

  -- 3) Technical log retention
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '2 days';
  GET DIAGNOSTICS runs = ROW_COUNT;

  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '6 hours';
    GET DIAGNOSTICS https = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    https := 0;
  END;

  -- 4) Application data retention (business records untouched)
  BEGIN
    DELETE FROM public.newsletter_sends WHERE created_at < now() - interval '180 days';
    GET DIAGNOSTICS n = ROW_COUNT; purged := purged + n;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    DELETE FROM public.email_log WHERE created_at < now() - interval '180 days';
    GET DIAGNOSTICS n = ROW_COUNT; purged := purged + n;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    DELETE FROM public.email_outbox
     WHERE created_at < now() - interval '30 days'
       AND status IN ('sent','failed','cancelled');
    GET DIAGNOSTICS n = ROW_COUNT; purged := purged + n;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    DELETE FROM public.portal_notifications
     WHERE created_at < now() - interval '90 days'
       AND COALESCE(is_read, false) = true;
    GET DIAGNOSTICS n = ROW_COUNT; purged := purged + n;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.system_maintenance_log (disabled_jobs, deleted_job_runs, deleted_http_rows)
  VALUES (killed, runs, https + purged);
END;
$fn$;