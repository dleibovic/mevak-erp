revoke execute on function public.has_mevak_role(uuid, public.mevak_role) from public, anon;
revoke execute on function public.get_mevak_role(uuid) from public, anon;
grant execute on function public.has_mevak_role(uuid, public.mevak_role) to authenticated;
grant execute on function public.get_mevak_role(uuid) to authenticated;