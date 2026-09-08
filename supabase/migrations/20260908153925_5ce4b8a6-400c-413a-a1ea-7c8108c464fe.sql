SELECT cron.unschedule('system-maintenance-guard');
SELECT cron.schedule('system-maintenance-guard', '15 21 * * *', $$SELECT public.run_system_maintenance();$$);