-- Guard the sync function: only delete previous 'ejecutivo_asignado' links
-- when the client actually has an assigned_executive_id. This prevents
-- wiping manual links on clients whose assigned_executive_id is NULL.
create or replace function public.mevak_sync_assigned_executive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_user uuid;
begin
  if (tg_op = 'UPDATE' and new.assigned_executive_id is distinct from old.assigned_executive_id)
     or tg_op = 'INSERT' then

    -- Only clear existing links when there is a new executive to assign.
    -- If assigned_executive_id is NULL, preserve manual links.
    if new.assigned_executive_id is not null then
      delete from public.mevak_cliente_usuarios
       where client_id = new.id
         and role = 'ejecutivo_asignado';

      select e.user_id
        into v_new_user
        from public.employees e
       where e.id = new.assigned_executive_id;

      if v_new_user is not null then
        insert into public.mevak_cliente_usuarios(user_id, client_id, role)
          values (v_new_user, new.id, 'ejecutivo_asignado')
          on conflict (user_id, client_id, role) do nothing;
      end if;
    end if;
  end if;
  return new;
end
$$;

notify pgrst, 'reload schema';