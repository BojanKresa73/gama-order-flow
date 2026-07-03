DROP FUNCTION IF EXISTS public.admin_list_users(text, integer, integer);

CREATE FUNCTION public.admin_list_users(
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  job_title text,
  role app_role,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Access denied: superuser role required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.full_name,
    p.phone,
    p.job_title,
    ur.role,
    p.is_active,
    p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE
    (ur.role IS NULL OR ur.role != 'client_user')
    AND (
      p_search = ''
      OR u.email ILIKE '%' || p_search || '%'
      OR p.full_name ILIKE '%' || p_search || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_job_title text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Access denied: superuser role required';
  END IF;

  UPDATE public.profiles
     SET full_name = NULLIF(btrim(p_full_name), ''),
         phone     = NULLIF(btrim(p_phone), ''),
         job_title = NULLIF(btrim(p_job_title), ''),
         updated_at = now()
   WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, text, text, text) TO authenticated;