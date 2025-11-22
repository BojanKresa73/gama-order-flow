-- Create view for quick role lookup in RLS/edge functions
CREATE OR REPLACE VIEW public.v_current_user_role
AS
SELECT ur.user_id, ur.role
FROM public.user_roles ur;