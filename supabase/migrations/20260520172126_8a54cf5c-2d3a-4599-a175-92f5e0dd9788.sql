-- ============================================================================
-- Mevak CRM — Sub-fase (c): Onboarding workflow obligatorio
-- Ajustes: company_name (no name), countries.iso2 (no country_code)
-- ============================================================================

-- 0. countries.iso2
alter table public.countries add column if not exists iso2 text;

update public.countries set iso2 = 'AR' where iso2 is null and lower(name) in ('argentina');
update public.countries set iso2 = 'BR' where iso2 is null and lower(name) in ('brasil', 'brazil');
update public.countries set iso2 = 'MX' where iso2 is null and lower(name) in ('méxico', 'mexico');
update public.countries set iso2 = 'US' where iso2 is null and lower(name) in ('eeuu', 'estados unidos', 'united states', 'usa');
update public.countries set iso2 = 'ES' where iso2 is null and lower(name) in ('españa', 'spain');
update public.countries set iso2 = 'GB' where iso2 is null and lower(name) in ('uk', 'reino unido', 'united kingdom');

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'countries_iso2_check') then
    alter table public.countries add constraint countries_iso2_check check (iso2 ~ '^[A-Z]{2}$' or iso2 is null);
  end if;
end $$;
create index if not exists countries_iso2_idx on public.countries (iso2);

-- 1. ALTER items: responsable
alter table public.mevak_onboarding_items
  add column if not exists responsable text;

-- 2. Audit log
create table if not exists public.mevak_onboarding_audit (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  item_id uuid references public.mevak_onboarding_items(id) on delete set null,
  evento text not null,
  detalle text,
  payload jsonb not null default '{}'::jsonb,
  actor uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_moa_client on public.mevak_onboarding_audit(client_id, created_at desc);
alter table public.mevak_onboarding_audit enable row level security;

drop policy if exists "moa_read" on public.mevak_onboarding_audit;
create policy "moa_read" on public.mevak_onboarding_audit
  for select to authenticated
  using (public.mevak_can_access_client(auth.uid(), client_id));

drop policy if exists "moa_no_write" on public.mevak_onboarding_audit;
create policy "moa_no_write" on public.mevak_onboarding_audit
  for all to authenticated
  using (false) with check (false);

-- 3. Seed template + 15 ítems
-- Necesitamos un unique en (nombre) para el on conflict, si no existe insertamos manualmente
do $seed$
declare
  tpl uuid;
  items jsonb := '[
    {"o":1,  "r":"finanzas",    "t":"Contrato firmado",                       "d":"Contrato comercial firmado por ambas partes."},
    {"o":2,  "r":"finanzas",    "t":"Fee mensual cargado en ERP",             "d":"Plan y fee cargados en el módulo financiero del ERP."},
    {"o":3,  "r":"direccion",   "t":"Ejecutivo asignado",                     "d":"Ejecutivo de cuenta asignado en mevak_cliente_usuarios."},
    {"o":4,  "r":"ejecutivo",   "t":"País, zona y moneda definidos",          "d":"País, zona operativa y moneda de facturación configurados."},
    {"o":5,  "r":"ejecutivo",   "t":"Frecuencia de reuniones acordada",       "d":"Cadencia (semanal/quincenal/mensual) y día/hora fijos."},
    {"o":6,  "r":"ejecutivo",   "t":"Objetivos comerciales definidos",        "d":"Objetivos cuantitativos T+3 / T+6 acordados con el cliente."},
    {"o":7,  "r":"cliente",     "t":"Manual de marca recibido",               "d":"Manual de marca + assets (logos, paleta) cargados."},
    {"o":8,  "r":"ejecutivo",   "t":"Contactos principales cargados",         "d":"Mínimo 1 contacto operativo y 1 de finanzas registrados."},
    {"o":9,  "r":"operaciones", "t":"Sucursales: datos físicos y de marca",   "d":"Por cada sucursal: dirección, horarios, imagen confirmada."},
    {"o":10, "r":"operaciones", "t":"Sucursal × plataforma: IDs y comisión",  "d":"Por cada cruce sucursal × plataforma: store ID, accesos, comisión configurada."},
    {"o":11, "r":"operaciones", "t":"Menú Excel cargado por sucursal",        "d":"Maestro de menú (Excel/CSV) cargado y validado por sucursal."},
    {"o":12, "r":"cliente",     "t":"Material visual cargado",                "d":"Fotos de productos en calidad mínima requerida cargadas."},
    {"o":13, "r":"ejecutivo",   "t":"Baseline KPIs definido (T0)",            "d":"KPIs base T0 capturados como referencia para deltas futuros."},
    {"o":14, "r":"ejecutivo",   "t":"Roadmap inicial con 3+ ítems",           "d":"Mínimo 3 ítems cargados en mevak_roadmap_items para arrancar."},
    {"o":15, "r":"ejecutivo",   "t":"Kickoff agendado",                       "d":"Reunión de kickoff cargada en mevak_reuniones."}
  ]'::jsonb;
  item jsonb;
begin
  select id into tpl from public.mevak_onboarding_templates where nombre = 'Default Mevak' limit 1;
  if tpl is null then
    insert into public.mevak_onboarding_templates (nombre, descripcion, is_default)
    values ('Default Mevak', 'Checklist mandatorio de onboarding para nuevos clientes', true)
    returning id into tpl;
  else
    update public.mevak_onboarding_templates
      set descripcion = 'Checklist mandatorio de onboarding para nuevos clientes', is_default = true
      where id = tpl;
  end if;

  for item in select * from jsonb_array_elements(items) loop
    if not exists (
      select 1 from public.mevak_onboarding_items
      where template_id = tpl and titulo = item->>'t'
    ) then
      insert into public.mevak_onboarding_items
        (template_id, titulo, descripcion, order_index, required, responsable)
      values
        (tpl, item->>'t', item->>'d', (item->>'o')::int, true, item->>'r');
    else
      update public.mevak_onboarding_items
         set descripcion = item->>'d',
             responsable = item->>'r',
             order_index = (item->>'o')::int,
             required = true
       where template_id = tpl and titulo = item->>'t';
    end if;
  end loop;
end $seed$;

-- 4. Instanciador + trigger en clients
create or replace function public.mevak_instantiate_onboarding(_client_id uuid)
returns int language plpgsql security definer set search_path = public
as $fn$
declare tpl uuid; inserted int := 0;
begin
  select id into tpl from public.mevak_onboarding_templates
   where is_default = true order by created_at asc limit 1;
  if tpl is null then return 0; end if;
  with ins as (
    insert into public.mevak_onboarding_status (client_id, item_id, status)
    select _client_id, i.id, 'pendiente'::public.mevak_onboarding_item_status
    from public.mevak_onboarding_items i
    where i.template_id = tpl
      and not exists (
        select 1 from public.mevak_onboarding_status s
        where s.client_id = _client_id and s.item_id = i.id
      )
    returning 1
  )
  select count(*) into inserted from ins;
  if inserted > 0 then
    insert into public.mevak_onboarding_audit (client_id, evento, detalle, payload)
    values (_client_id, 'instanciado',
            format('%s ítems creados desde template default', inserted),
            jsonb_build_object('template_id', tpl, 'items', inserted));
  end if;
  return inserted;
end; $fn$;

create or replace function public.mevak_clients_onboarding_tg()
returns trigger language plpgsql security definer set search_path = public
as $tg$
begin
  if tg_op = 'INSERT' then
    if new.status = 'onboarding' then
      perform public.mevak_instantiate_onboarding(new.id);
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.status = 'onboarding' and (old.status is distinct from 'onboarding') then
      perform public.mevak_instantiate_onboarding(new.id);
    end if;
    return new;
  end if;
  return new;
end; $tg$;

drop trigger if exists trg_mevak_clients_onboarding on public.clients;
create trigger trg_mevak_clients_onboarding
  after insert or update of status on public.clients
  for each row execute function public.mevak_clients_onboarding_tg();

-- 5. Auto-activación
create or replace function public.mevak_onboarding_is_complete(_client_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select not exists (
    select 1 from public.mevak_onboarding_status s
    join public.mevak_onboarding_items i on i.id = s.item_id
    where s.client_id = _client_id and i.required = true
      and s.status not in ('completado', 'no_aplica')
  )
  and exists (select 1 from public.mevak_onboarding_status where client_id = _client_id);
$$;

create or replace function public.mevak_onboarding_status_tg()
returns trigger language plpgsql security definer set search_path = public
as $tg$
declare complete boolean; current_status public.client_status;
begin
  if tg_op = 'UPDATE' and (old.status is distinct from new.status) then
    if new.status = 'completado' then
      insert into public.mevak_onboarding_audit (client_id, item_id, evento, actor)
      values (new.client_id, new.item_id, 'item_completado', new.completed_by);
    elsif new.status = 'no_aplica' then
      insert into public.mevak_onboarding_audit (client_id, item_id, evento, detalle, actor)
      values (new.client_id, new.item_id, 'item_no_aplica', new.notas, new.completed_by);
    elsif old.status in ('completado', 'no_aplica') then
      insert into public.mevak_onboarding_audit (client_id, item_id, evento, actor)
      values (new.client_id, new.item_id, 'item_reabierto', auth.uid());
    end if;
  end if;
  select public.mevak_onboarding_is_complete(new.client_id) into complete;
  if complete then
    select status into current_status from public.clients where id = new.client_id;
    if current_status = 'onboarding' then
      update public.clients set status = 'active' where id = new.client_id;
      insert into public.mevak_onboarding_audit (client_id, evento, detalle)
      values (new.client_id, 'activacion_auto', 'Checklist completo, cliente pasado a active.');
      insert into public.mevak_alertas
        (client_id, severity, status, tipo, titulo, detalle, payload)
      values
        (new.client_id, 'info', 'abierta', 'onboarding_completo',
         'Onboarding completado', 'El cliente fue activado automáticamente.',
         jsonb_build_object('source', 'mevak_onboarding_status_tg'));
    end if;
  end if;
  return new;
end; $tg$;

drop trigger if exists trg_mevak_onboarding_status on public.mevak_onboarding_status;
create trigger trg_mevak_onboarding_status
  after update on public.mevak_onboarding_status
  for each row execute function public.mevak_onboarding_status_tg();

-- 6. RPC set_item_status
create or replace function public.mevak_set_item_status(
  _client_id uuid, _item_id uuid,
  _status public.mevak_onboarding_item_status, _notas text default null
)
returns public.mevak_onboarding_status
language plpgsql security definer set search_path = public
as $fn$
declare caller uuid := auth.uid(); row public.mevak_onboarding_status;
begin
  if caller is null then raise exception 'No autenticado'; end if;
  if not public.mevak_can_write_client(caller, _client_id) then
    raise exception 'Sin permiso para escribir onboarding de este cliente';
  end if;
  if _status = 'no_aplica' then
    if not public.has_mevak_role(caller, 'direccion') then
      raise exception 'Solo Dirección puede marcar un ítem como no_aplica';
    end if;
    if _notas is null or length(trim(_notas)) < 3 then
      raise exception 'no_aplica requiere una justificación (notas)';
    end if;
  end if;
  update public.mevak_onboarding_status s
     set status = _status,
         notas = coalesce(_notas, s.notas),
         completed_by = case when _status in ('completado', 'no_aplica') then caller else null end,
         completed_at = case when _status in ('completado', 'no_aplica') then now() else null end,
         updated_at = now()
   where s.client_id = _client_id and s.item_id = _item_id
  returning * into row;
  if row.id is null then raise exception 'Ítem no encontrado para este cliente'; end if;
  return row;
end; $fn$;

-- 7. Activación manual
create or replace function public.mevak_activate_client_manual(_client_id uuid)
returns public.client_status
language plpgsql security definer set search_path = public
as $fn$
declare caller uuid := auth.uid(); complete boolean;
begin
  if not public.has_mevak_role(caller, 'direccion') then
    raise exception 'Solo Dirección puede activar clientes';
  end if;
  select public.mevak_onboarding_is_complete(_client_id) into complete;
  if not complete then
    insert into public.mevak_onboarding_audit (client_id, evento, detalle, actor)
    values (_client_id, 'activacion_bloqueada',
            'Intento de activar manualmente con checklist incompleto', caller);
    raise exception 'Onboarding incompleto: no se puede activar el cliente';
  end if;
  update public.clients set status = 'active' where id = _client_id;
  insert into public.mevak_onboarding_audit (client_id, evento, actor)
  values (_client_id, 'activacion_manual', caller);
  return 'active'::public.client_status;
end; $fn$;

-- 8. RPCs de listado (company_name as name, iso2 as country_code)
create or replace function public.mevak_list_clients_for_mevak()
returns table (
  id uuid, name text, status public.client_status, country_code text,
  created_at timestamptz, ejecutivo_id uuid, ejecutivo_email text,
  onboarding_total int, onboarding_completed int, onboarding_pct numeric
)
language sql stable security definer set search_path = public
as $$
  with base as (
    select c.id, c.company_name as name, c.status, co.iso2 as country_code, c.created_at, c.country_id
    from public.clients c
    left join public.countries co on co.id = c.country_id
    where public.mevak_can_access_client(auth.uid(), c.id)
  ),
  ejec as (
    select cu.client_id, cu.user_id, u.email::text as email
    from public.mevak_cliente_usuarios cu
    join auth.users u on u.id = cu.user_id
    where cu.role = 'ejecutivo_asignado'
  ),
  prog as (
    select s.client_id,
           count(*) as total,
           count(*) filter (where s.status in ('completado','no_aplica')) as done
    from public.mevak_onboarding_status s
    join public.mevak_onboarding_items i on i.id = s.item_id and i.required = true
    group by s.client_id
  )
  select b.id, b.name, b.status, b.country_code, b.created_at,
         e.user_id, e.email,
         coalesce(p.total, 0)::int, coalesce(p.done, 0)::int,
         case when coalesce(p.total,0) = 0 then 0
              else round(100.0 * p.done / p.total, 1) end
  from base b
  left join ejec e on e.client_id = b.id
  left join prog p on p.client_id = b.id;
$$;

create or replace function public.mevak_list_onboarding_pipeline()
returns table (
  id uuid, name text, country_code text, created_at timestamptz,
  ejecutivo_email text, total int, done int, pct numeric, days_open int
)
language sql stable security definer set search_path = public
as $$
  select id, name, country_code, created_at, ejecutivo_email,
         onboarding_total, onboarding_completed, onboarding_pct,
         greatest(0, extract(day from (now() - created_at))::int) as days_open
  from public.mevak_list_clients_for_mevak()
  where status = 'onboarding';
$$;

create or replace function public.mevak_get_onboarding_for_client(_client_id uuid)
returns table (
  status_id uuid, item_id uuid, titulo text, descripcion text,
  order_index int, required boolean, responsable text,
  status public.mevak_onboarding_item_status, notas text,
  completed_by uuid, completed_at timestamptz, updated_at timestamptz,
  days_since_update int
)
language sql stable security definer set search_path = public
as $$
  select s.id, i.id, i.titulo, i.descripcion, i.order_index, i.required, i.responsable,
         s.status, s.notas, s.completed_by, s.completed_at, s.updated_at,
         greatest(0, extract(day from (now() - s.updated_at))::int)
  from public.mevak_onboarding_status s
  join public.mevak_onboarding_items i on i.id = s.item_id
  where s.client_id = _client_id
    and public.mevak_can_access_client(auth.uid(), _client_id)
  order by i.order_index asc;
$$;

-- 9. Tightening de las 5 RPCs nuevas + helpers nuevos
revoke execute on function public.mevak_instantiate_onboarding(uuid) from public, anon;
revoke execute on function public.mevak_onboarding_is_complete(uuid) from public, anon;
revoke execute on function public.mevak_set_item_status(uuid, uuid, public.mevak_onboarding_item_status, text) from public, anon;
revoke execute on function public.mevak_activate_client_manual(uuid) from public, anon;
revoke execute on function public.mevak_list_clients_for_mevak() from public, anon;
revoke execute on function public.mevak_list_onboarding_pipeline() from public, anon;
revoke execute on function public.mevak_get_onboarding_for_client(uuid) from public, anon;

grant execute on function public.mevak_set_item_status(uuid, uuid, public.mevak_onboarding_item_status, text) to authenticated;
grant execute on function public.mevak_activate_client_manual(uuid) to authenticated;
grant execute on function public.mevak_list_clients_for_mevak() to authenticated;
grant execute on function public.mevak_list_onboarding_pipeline() to authenticated;
grant execute on function public.mevak_get_onboarding_for_client(uuid) to authenticated;
-- internal helpers: solo para uso de los triggers (SECURITY DEFINER → no necesitan grant)

-- 10. PostgREST schema cache reload
notify pgrst, 'reload schema';

-- 11. DEMO: 2 clientes de prueba (Argentina garantizado)
do $demo$
declare
  ar_id uuid;
  c1 uuid;
  c2 uuid;
begin
  select id into ar_id from public.countries where iso2 = 'AR' limit 1;
  if ar_id is null then
    insert into public.countries (name, currency_code, currency_symbol, iso2)
    values ('Argentina', 'ARS', '$', 'AR')
    returning id into ar_id;
  end if;

  -- Cliente 0%
  if not exists (select 1 from public.clients where company_name = 'Demo Onboarding 0%') then
    insert into public.clients (company_name, status, country_id)
    values ('Demo Onboarding 0%', 'onboarding', ar_id)
    returning id into c1;
  end if;

  -- Cliente 40%
  if not exists (select 1 from public.clients where company_name = 'Demo Onboarding 40%') then
    insert into public.clients (company_name, status, country_id)
    values ('Demo Onboarding 40%', 'onboarding', ar_id)
    returning id into c2;

    update public.mevak_onboarding_status s
       set status = 'completado', completed_at = now(), updated_at = now()
     where s.client_id = c2
       and s.item_id in (
         select i.id from public.mevak_onboarding_items i
         join public.mevak_onboarding_templates t on t.id = i.template_id
         where t.is_default = true
         order by i.order_index asc limit 6
       );
  end if;
end $demo$;