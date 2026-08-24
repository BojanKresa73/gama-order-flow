REVOKE EXECUTE ON FUNCTION public.next_complaint_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_complaint_before_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_complaint_log_status() FROM anon, authenticated, public;