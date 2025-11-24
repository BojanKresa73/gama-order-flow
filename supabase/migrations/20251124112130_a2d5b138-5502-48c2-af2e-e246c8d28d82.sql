-- Fix Security Definer View issue
-- Change v_current_user_role to use SECURITY INVOKER instead of SECURITY DEFINER
-- This makes the view enforce RLS and permissions of the querying user, not the view creator

ALTER VIEW v_current_user_role SET (security_invoker = on);