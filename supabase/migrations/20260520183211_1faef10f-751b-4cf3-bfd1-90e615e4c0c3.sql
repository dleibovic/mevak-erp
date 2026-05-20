-- 0. Extender mevak_reuniones
alter table public.mevak_reuniones
  add column if not exists tipo text,
  add column if not exists asistentes jsonb not null default '[]'::jsonb,
  add column if not exists minuta_md text,
  add column if not exists decisiones jsonb not null default '[]'::jsonb,
  add column if not exists proxima_fecha timestamptz;

-- 1. mevak_sucursales
create table if not exists public.mevak_sucursales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_sub_brand_id uuid references public.client_sub_brands(id) on delete set null,
  nombre text not null,
  direccion text,
  ciudad text,
  country_code text,
  tipo text not null default 'sucursal',
  activa boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mevak_sucursales
  add column if not exists client_sub_brand_id uuid references public.client_sub_brands(id) on delete set null;
create index if not exists idx_msuc_client on public.mevak_sucursales(client_id, activa);
create index if not exists idx_msuc_client_brand on public.mevak_sucursales(client_id, client_sub_brand_id);

-- 2. mevak_sucursal_plataforma
create table if not exists public.mevak_sucursal_plataforma (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sucursal_id uuid not null references public.mevak_sucursales(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete cascade,
  branch_id_external text,
  comision_pct numeric(5,2),
  horarios jsonb not null default '{}'::jsonb,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sucursal_id, platform_id)
);
create index if not exists idx_msp_client on public.mevak_sucursal_plataforma(client_id);

-- 3. mevak_contactos
create table if not exists public.mevak_contactos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tipo text not null default 'marca',
  platform_id uuid references public.platforms(id) on delete set null,
  nombre text not null,
  rol text,
  email text,
  telefono text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mcont_client on public.mevak_contactos(client_id, tipo);

-- 4. mevak_reunion_tareas
create table if not exists public.mevak_reunion_tareas (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.mevak_reuniones(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  descripcion text not null,
  responsable uuid references auth.users(id),
  due_date date,
  status public.mevak_tarea_status not null default 'pendiente',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mrt_reunion on public.mevak_reunion_tareas(reunion_id);
create index if not exists idx_mrt_client on public.mevak_reunion_tareas(client_id, status);

-- 5. mevak_objetivos
create table if not exists public.mevak_objetivos (
  client_id uuid primary key references public.clients(id) on delete cascade,
  descripcion_md text,
  kpi_1 jsonb, kpi_2 jsonb, kpi_3 jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- 6. mevak_comentarios_internos
create table if not exists public.mevak_comentarios_internos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  autor_id uuid references auth.users(id),
  contenido_md text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_mci_client on public.mevak_comentarios_internos(client_id, created_at desc);

-- 7. mevak_timeline_eventos
create table if not exists public.mevak_timeline_eventos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  detalle text,
  payload jsonb not null default '{}'::jsonb,
  source_table text,
  source_id uuid,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_mte_client_time on public.mevak_timeline_eventos(client_id, created_at desc);

-- RLS enable
do $$
declare t text;
begin
  foreach t in array array[
    'mevak_sucursales','mevak_sucursal_plataforma','mevak_contactos',
    'mevak_reunion_tareas','mevak_objetivos','mevak_comentarios_internos','mevak_timeline_eventos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Policies
drop policy if exists "msuc_select" on public.mevak_sucursales;
create policy "msuc_select" on public.mevak_sucursales for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id));
drop policy if exists "msuc_write" on public.mevak_sucursales;
create policy "msuc_write" on public.mevak_sucursales for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))))
  with check (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))));

drop policy if exists "msp_select" on public.mevak_sucursal_plataforma;
create policy "msp_select" on public.mevak_sucursal_plataforma for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id));
drop policy if exists "msp_write" on public.mevak_sucursal_plataforma;
create policy "msp_write" on public.mevak_sucursal_plataforma for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))))
  with check (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))));

drop policy if exists "mcont_select" on public.mevak_contactos;
create policy "mcont_select" on public.mevak_contactos for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id));
drop policy if exists "mcont_write" on public.mevak_contactos;
create policy "mcont_write" on public.mevak_contactos for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))))
  with check (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))));

drop policy if exists "mrt_select" on public.mevak_reunion_tareas;
create policy "mrt_select" on public.mevak_reunion_tareas for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id));
drop policy if exists "mrt_write" on public.mevak_reunion_tareas;
create policy "mrt_write" on public.mevak_reunion_tareas for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))))
  with check (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))));

drop policy if exists "mobj_select" on public.mevak_objetivos;
create policy "mobj_select" on public.mevak_objetivos for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id));
drop policy if exists "mobj_write" on public.mevak_objetivos;
create policy "mobj_write" on public.mevak_objetivos for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))))
  with check (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))));

drop policy if exists "mci_select" on public.mevak_comentarios_internos;
create policy "mci_select" on public.mevak_comentarios_internos for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id)
    and not public.has_mevak_role(auth.uid(), 'cliente'));
drop policy if exists "mci_write" on public.mevak_comentarios_internos;
create policy "mci_write" on public.mevak_comentarios_internos for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))))
  with check (public.has_mevak_role(auth.uid(), 'direccion')
    or (public.has_mevak_role(auth.uid(), 'ejecutivo') and client_id in (select public.mevak_my_client_ids(auth.uid()))));

drop policy if exists "mte_select" on public.mevak_timeline_eventos;
create policy "mte_select" on public.mevak_timeline_eventos for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id));

-- Triggers de Timeline
create or replace function public.mevak_timeline_from_onboarding()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_titulo text;
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status)
     and new.status in ('completado','no_aplica') then
    select coalesce(i.titulo, 'Ítem onboarding') into v_titulo
      from public.mevak_onboarding_items i where i.id = new.item_id;
    insert into public.mevak_timeline_eventos(
      client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
    ) values (
      new.client_id, 'onboarding_item',
      case when new.status = 'completado' then 'Ítem completado' else 'Ítem marcado no aplica' end,
      v_titulo,
      jsonb_build_object('status', new.status, 'notas', new.notas),
      'mevak_onboarding_status', new.id, auth.uid()
    );
  end if;
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_onboarding on public.mevak_onboarding_status;
create trigger trg_mevak_timeline_onboarding
  after update on public.mevak_onboarding_status
  for each row execute function public.mevak_timeline_from_onboarding();

create or replace function public.mevak_timeline_from_client_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.mevak_timeline_eventos(
      client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
    ) values (
      new.id, 'client_status', 'Cambio de estado',
      format('%s → %s', old.status, new.status),
      jsonb_build_object('from', old.status, 'to', new.status),
      'clients', new.id, auth.uid()
    );
  end if;
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_client_status on public.clients;
create trigger trg_mevak_timeline_client_status
  after update of status on public.clients
  for each row execute function public.mevak_timeline_from_client_status();

create or replace function public.mevak_timeline_from_reunion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'reunion', coalesce(new.titulo, 'Reunión'),
    to_char(new.scheduled_at, 'YYYY-MM-DD HH24:MI'),
    jsonb_build_object('scheduled_at', new.scheduled_at, 'status', new.status),
    'mevak_reuniones', new.id, auth.uid()
  );
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_reunion on public.mevak_reuniones;
create trigger trg_mevak_timeline_reunion
  after insert on public.mevak_reuniones
  for each row execute function public.mevak_timeline_from_reunion();

create or replace function public.mevak_timeline_from_alerta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'alerta', new.titulo, new.detalle,
    jsonb_build_object('severity', new.severity, 'tipo', new.tipo),
    'mevak_alertas', new.id, null
  );
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_alerta on public.mevak_alertas;
create trigger trg_mevak_timeline_alerta
  after insert on public.mevak_alertas
  for each row execute function public.mevak_timeline_from_alerta();

create or replace function public.mevak_timeline_from_reunion_tarea()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.mevak_timeline_eventos(
      client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
    ) values (
      new.client_id, 'tarea', 'Tarea: ' || new.status, new.descripcion,
      jsonb_build_object('from', old.status, 'to', new.status),
      'mevak_reunion_tareas', new.id, auth.uid()
    );
  end if;
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_reunion_tarea on public.mevak_reunion_tareas;
create trigger trg_mevak_timeline_reunion_tarea
  after update on public.mevak_reunion_tareas
  for each row execute function public.mevak_timeline_from_reunion_tarea();

-- Sync ejecutivo asignado (usa assigned_executive_id)
create or replace function public.mevak_sync_assigned_executive()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_new_user uuid;
begin
  if (tg_op = 'UPDATE' and new.assigned_executive_id is distinct from old.assigned_executive_id)
     or tg_op = 'INSERT' then
    delete from public.mevak_cliente_usuarios
      where client_id = new.id and role = 'ejecutivo_asignado';
    if new.assigned_executive_id is not null then
      select e.user_id into v_new_user
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
end $$;
drop trigger if exists trg_mevak_sync_assigned_executive on public.clients;
create trigger trg_mevak_sync_assigned_executive
  after insert or update of assigned_executive_id on public.clients
  for each row execute function public.mevak_sync_assigned_executive();

-- Backfill
do $$
begin
  delete from public.mevak_cliente_usuarios mcu
    where mcu.role = 'ejecutivo_asignado'
      and not exists (
        select 1 from public.clients c
        join public.employees e on e.id = c.assigned_executive_id
        where c.id = mcu.client_id and e.user_id = mcu.user_id
      );
  insert into public.mevak_cliente_usuarios(user_id, client_id, role)
    select e.user_id, c.id, 'ejecutivo_asignado'
      from public.clients c
      join public.employees e on e.id = c.assigned_executive_id
      where e.user_id is not null
    on conflict (user_id, client_id, role) do nothing;
end $$;

-- RPCs
create or replace function public.mevak_get_client_360(_client_id uuid)
returns table (
  id uuid, name text, status text, country_code text,
  activated_at timestamptz, created_at timestamptz,
  ejecutivo_email text, meeting_frequency text,
  sucursales_count int, contactos_count int, reuniones_count int,
  promos_count int, timeline_count int, comentarios_count int
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.company_name::text, c.status::text, co.iso2::text,
    c.activated_at::timestamptz, c.created_at,
    (select u.email::text from public.mevak_cliente_usuarios cu
       join auth.users u on u.id = cu.user_id
       where cu.client_id = c.id and cu.role = 'ejecutivo_asignado' limit 1),
    null::text,
    (select count(*)::int from public.mevak_sucursales where client_id = c.id and activa),
    (select count(*)::int from public.mevak_contactos where client_id = c.id),
    (select count(*)::int from public.mevak_reuniones where client_id = c.id),
    (select count(*)::int from public.mevak_promociones where client_id = c.id),
    (select count(*)::int from public.mevak_timeline_eventos where client_id = c.id),
    (select count(*)::int from public.mevak_comentarios_internos where client_id = c.id)
  from public.clients c
  left join public.countries co on co.id = c.country_id
  where c.id = _client_id and public.mevak_can_access_client(auth.uid(), c.id);
$$;

create or replace function public.mevak_list_timeline(_client_id uuid, _limit int default 100)
returns setof public.mevak_timeline_eventos
language sql stable security definer set search_path = public as $$
  select * from public.mevak_timeline_eventos
   where client_id = _client_id and public.mevak_can_access_client(auth.uid(), client_id)
   order by created_at desc limit _limit;
$$;

create or replace function public.mevak_list_sucursales(_client_id uuid)
returns table (
  id uuid, client_id uuid, client_sub_brand_id uuid, sub_brand_name text,
  nombre text, direccion text, ciudad text, country_code text,
  tipo text, activa boolean, metadata jsonb,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.client_id, s.client_sub_brand_id, sb.name::text,
         s.nombre, s.direccion, s.ciudad, s.country_code,
         s.tipo, s.activa, s.metadata, s.created_at, s.updated_at
    from public.mevak_sucursales s
    left join public.client_sub_brands sb on sb.id = s.client_sub_brand_id
   where s.client_id = _client_id
     and public.mevak_can_access_client(auth.uid(), s.client_id)
   order by s.activa desc, sb.name nulls last, s.nombre asc;
$$;

create or replace function public.mevak_list_client_sub_brands(_client_id uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select sb.id, sb.name::text
    from public.client_sub_brands sb
   where sb.client_id = _client_id
     and public.mevak_can_access_client(auth.uid(), _client_id)
   order by sb.name;
$$;

create or replace function public.mevak_list_sucursal_plataforma(_client_id uuid)
returns table (
  id uuid, sucursal_id uuid, sucursal_nombre text,
  platform_id uuid, platform_name text,
  branch_id_external text, comision_pct numeric, horarios jsonb, notas text
)
language sql stable security definer set search_path = public as $$
  select sp.id, sp.sucursal_id, s.nombre::text,
         sp.platform_id, p.name::text,
         sp.branch_id_external, sp.comision_pct, sp.horarios, sp.notas
    from public.mevak_sucursal_plataforma sp
    join public.mevak_sucursales s on s.id = sp.sucursal_id
    join public.platforms p on p.id = sp.platform_id
   where sp.client_id = _client_id
     and public.mevak_can_access_client(auth.uid(), sp.client_id)
   order by s.nombre, p.name;
$$;

create or replace function public.mevak_list_contactos(_client_id uuid)
returns table (
  id uuid, tipo text, platform_id uuid, platform_name text,
  nombre text, rol text, email text, telefono text, notas text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.tipo, c.platform_id, p.name::text,
         c.nombre, c.rol, c.email, c.telefono, c.notas
    from public.mevak_contactos c
    left join public.platforms p on p.id = c.platform_id
   where c.client_id = _client_id
     and public.mevak_can_access_client(auth.uid(), c.client_id)
   order by c.tipo, c.nombre;
$$;

create or replace function public.mevak_list_reuniones(_client_id uuid)
returns setof public.mevak_reuniones
language sql stable security definer set search_path = public as $$
  select * from public.mevak_reuniones
   where client_id = _client_id and public.mevak_can_access_client(auth.uid(), client_id)
   order by scheduled_at desc;
$$;

create or replace function public.mevak_list_reunion_tareas(_client_id uuid)
returns setof public.mevak_reunion_tareas
language sql stable security definer set search_path = public as $$
  select * from public.mevak_reunion_tareas
   where client_id = _client_id and public.mevak_can_access_client(auth.uid(), client_id)
   order by created_at desc;
$$;

create or replace function public.mevak_get_objetivos(_client_id uuid)
returns setof public.mevak_objetivos
language sql stable security definer set search_path = public as $$
  select * from public.mevak_objetivos
   where client_id = _client_id and public.mevak_can_access_client(auth.uid(), client_id);
$$;

create or replace function public.mevak_list_comentarios(_client_id uuid)
returns table (id uuid, autor_email text, contenido_md text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id,
         (select email from auth.users u where u.id = c.autor_id)::text,
         c.contenido_md, c.created_at
    from public.mevak_comentarios_internos c
   where c.client_id = _client_id
     and public.mevak_can_access_client(auth.uid(), c.client_id)
     and not public.has_mevak_role(auth.uid(), 'cliente')
   order by c.created_at desc;
$$;

create or replace function public.mevak_list_roadmap_items(_client_id uuid)
returns setof public.mevak_roadmap_items
language sql stable security definer set search_path = public as $$
  select * from public.mevak_roadmap_items
   where client_id = _client_id and public.mevak_can_access_client(auth.uid(), client_id)
   order by order_index, created_at;
$$;

-- Grants
revoke all on function public.mevak_get_client_360(uuid) from public, anon;
revoke all on function public.mevak_list_timeline(uuid, int) from public, anon;
revoke all on function public.mevak_list_sucursales(uuid) from public, anon;
revoke all on function public.mevak_list_sucursal_plataforma(uuid) from public, anon;
revoke all on function public.mevak_list_contactos(uuid) from public, anon;
revoke all on function public.mevak_list_reuniones(uuid) from public, anon;
revoke all on function public.mevak_list_reunion_tareas(uuid) from public, anon;
revoke all on function public.mevak_get_objetivos(uuid) from public, anon;
revoke all on function public.mevak_list_comentarios(uuid) from public, anon;
revoke all on function public.mevak_list_roadmap_items(uuid) from public, anon;
revoke all on function public.mevak_list_client_sub_brands(uuid) from public, anon;

grant execute on function public.mevak_get_client_360(uuid) to authenticated;
grant execute on function public.mevak_list_timeline(uuid, int) to authenticated;
grant execute on function public.mevak_list_sucursales(uuid) to authenticated;
grant execute on function public.mevak_list_sucursal_plataforma(uuid) to authenticated;
grant execute on function public.mevak_list_contactos(uuid) to authenticated;
grant execute on function public.mevak_list_reuniones(uuid) to authenticated;
grant execute on function public.mevak_list_reunion_tareas(uuid) to authenticated;
grant execute on function public.mevak_get_objetivos(uuid) to authenticated;
grant execute on function public.mevak_list_comentarios(uuid) to authenticated;
grant execute on function public.mevak_list_roadmap_items(uuid) to authenticated;
grant execute on function public.mevak_list_client_sub_brands(uuid) to authenticated;

notify pgrst, 'reload schema';