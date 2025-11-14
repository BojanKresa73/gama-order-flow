-- Helper funkcija za proveru više rola odjednom
create or replace function public.has_any_role(p_roles app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = any(p_roles)
  )
$$;

-- 1) Pregled korisnika (paginacija + pretraga)
create or replace function public.admin_list_users(
  p_search text default '',
  p_limit  int  default 50,
  p_offset int  default 0
) returns table (
  id uuid,
  email text,
  full_name text,
  role app_role,
  is_active boolean,
  created_at timestamptz
) language sql security definer set search_path = public, auth as
$$
  select
    u.id,
    u.email,
    p.full_name,
    ur.role,
    coalesce(p.is_active, true) as is_active,
    u.created_at
  from auth.users u
  left join public.profiles   p  on p.id = u.id
  left join public.user_roles ur on ur.user_id = u.id
  where
    (lower(u.email) like '%' || lower(p_search) || '%'
     or lower(coalesce(p.full_name,'')) like '%' || lower(p_search) || '%')
  order by u.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.admin_list_users(text,int,int) to authenticated;

-- 2) Promena uloge
create or replace function public.admin_set_user_role(p_user_id uuid, p_role app_role)
returns void language plpgsql security definer set search_path = public as
$$
begin
  -- Provera da li trenutni korisnik ima admin ili superuser rolu
  if not public.has_any_role(array['superuser','admin']::app_role[]) then
    raise exception 'Nemate dozvolu za ovu akciju';
  end if;

  -- Ukloni postojeću rolu ako postoji
  delete from public.user_roles where user_id = p_user_id;
  
  -- Dodaj novu rolu
  insert into public.user_roles(user_id, role)
  values (p_user_id, p_role);
end;
$$;

grant execute on function public.admin_set_user_role(uuid, app_role) to authenticated;

-- 3) Aktivacija/deaktivacija
create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as
$$
begin
  -- Provera da li trenutni korisnik ima admin ili superuser rolu
  if not public.has_any_role(array['superuser','admin']::app_role[]) then
    raise exception 'Nemate dozvolu za ovu akciju';
  end if;

  -- Ažuriraj is_active flag
  update public.profiles
  set is_active = p_active, updated_at = now()
  where id = p_user_id;
  
  -- Ako korisnik ne postoji u profiles, kreiraj ga
  if not found then
    insert into public.profiles(id, is_active)
    values (p_user_id, p_active);
  end if;
end;
$$;

grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

-- 4) Reset lozinke (opciono - šalje reset email)
create or replace function public.admin_reset_user_password(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as
$$
declare
  v_email text;
begin
  -- Provera dozvole
  if not public.has_any_role(array['superuser','admin']::app_role[]) then
    raise exception 'Nemate dozvolu za ovu akciju';
  end if;

  -- Preuzmi email korisnika
  select email into v_email
  from auth.users
  where id = p_user_id;

  if v_email is null then
    return jsonb_build_object('success', false, 'error', 'Korisnik nije pronađen');
  end if;

  -- Ovde bi trebalo pozvati Supabase auth API za slanje reset emaila
  -- Za sada vraćamo email da frontend može da pozove resetPasswordForEmail
  return jsonb_build_object('success', true, 'email', v_email);
end;
$$;

grant execute on function public.admin_reset_user_password(uuid) to authenticated;