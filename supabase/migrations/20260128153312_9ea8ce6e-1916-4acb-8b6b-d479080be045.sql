-- Update admin_list_users to exclude client_user role (portal users)
CREATE OR REPLACE FUNCTION admin_list_users(
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role app_role,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superuser can list users
  IF NOT has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Access denied: superuser role required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    u.email::text,
    p.full_name,
    ur.role,
    p.is_active,
    p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE 
    -- Exclude client_user role (portal users are managed separately)
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