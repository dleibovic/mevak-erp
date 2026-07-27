CREATE OR REPLACE FUNCTION public.is_admin_or_administracion(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','administracion')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_administracion(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_administracion(uuid) TO authenticated;