CREATE OR REPLACE FUNCTION public.admin_list_user_status()
RETURNS TABLE (user_id uuid, banned boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, (u.banned_until IS NOT NULL AND u.banned_until > now()) AS banned
  FROM auth.users u
  WHERE public.is_admin(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.admin_list_user_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_user_status() TO authenticated;