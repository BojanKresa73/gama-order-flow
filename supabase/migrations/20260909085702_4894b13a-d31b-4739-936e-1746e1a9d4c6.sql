REVOKE EXECUTE ON FUNCTION public.run_system_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_system_maintenance() TO postgres, service_role;