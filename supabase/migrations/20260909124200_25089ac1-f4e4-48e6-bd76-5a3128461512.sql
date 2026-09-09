REVOKE ALL ON FUNCTION public.get_client_ctp_monthly(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_ctp_monthly(uuid, integer) TO authenticated, service_role;