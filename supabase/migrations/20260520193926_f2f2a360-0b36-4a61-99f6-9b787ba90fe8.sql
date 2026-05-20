
-- ============================================================================
-- Micro-migración: Triggers de Timeline (5 reparados + 5 nuevos)
-- Idempotente. No backfillea eventos viejos.
-- ============================================================================

-- ----- (1) Reparar los 5 triggers cuyas funciones ya existen ----------------

drop trigger if exists trg_mevak_timeline_from_client_status on public.clients;
create trigger trg_mevak_timeline_from_client_status
  after update on public.clients
  for each row execute function public.mevak_timeline_from_client_status();

drop trigger if exists trg_mevak_timeline_from_alerta on public.mevak_alertas;
create trigger trg_mevak_timeline_from_alerta
  after insert on public.mevak_alertas
  for each row execute function public.mevak_timeline_from_alerta();

drop trigger if exists trg_mevak_timeline_from_reunion on public.mevak_reuniones;
create trigger trg_mevak_timeline_from_reunion
  after insert on public.mevak_reuniones
  for each row execute function public.mevak_timeline_from_reunion();

drop trigger if exists trg_mevak_timeline_from_reunion_tarea on public.mevak_reunion_tareas;
create trigger trg_mevak_timeline_from_reunion_tarea
  after update on public.mevak_reunion_tareas
  for each row execute function public.mevak_timeline_from_reunion_tarea();

drop trigger if exists trg_mevak_timeline_from_onboarding on public.mevak_onboarding_status;
create trigger trg_mevak_timeline_from_onboarding
  after update on public.mevak_onboarding_status
  for each row execute function public.mevak_timeline_from_onboarding();


-- ----- (2) Funciones + triggers nuevos --------------------------------------

-- Sucursales
create or replace function public.mevak_timeline_from_sucursal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'sucursal', 'Nueva sucursal',
    coalesce(new.nombre, '(sin nombre)'),
    jsonb_build_object('activa', new.activa, 'tipo', new.tipo, 'ciudad', new.ciudad),
    'mevak_sucursales', new.id, auth.uid()
  );
  return new;
end $$;

drop trigger if exists trg_mevak_timeline_from_sucursal on public.mevak_sucursales;
create trigger trg_mevak_timeline_from_sucursal
  after insert on public.mevak_sucursales
  for each row execute function public.mevak_timeline_from_sucursal();


-- Sucursal ↔ Plataforma
create or replace function public.mevak_timeline_from_sucursal_plataforma()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sucursal text; v_platform text;
begin
  select nombre into v_sucursal from public.mevak_sucursales where id = new.sucursal_id;
  select name   into v_platform from public.platforms        where id = new.platform_id;
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'sucursal_plataforma',
    'Plataforma vinculada a sucursal',
    coalesce(v_sucursal, '?') || ' ↔ ' || coalesce(v_platform, '?'),
    jsonb_build_object(
      'sucursal_id', new.sucursal_id,
      'platform_id', new.platform_id,
      'branch_id_external', new.branch_id_external,
      'comision_pct', new.comision_pct
    ),
    'mevak_sucursal_plataforma', new.id, auth.uid()
  );
  return new;
end $$;

drop trigger if exists trg_mevak_timeline_from_sucursal_plataforma on public.mevak_sucursal_plataforma;
create trigger trg_mevak_timeline_from_sucursal_plataforma
  after insert on public.mevak_sucursal_plataforma
  for each row execute function public.mevak_timeline_from_sucursal_plataforma();


-- Contactos
create or replace function public.mevak_timeline_from_contacto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'contacto', 'Nuevo contacto',
    coalesce(new.nombre, '(sin nombre)') ||
      case when new.rol is not null then ' — ' || new.rol else '' end,
    jsonb_build_object('tipo', new.tipo, 'email', new.email, 'telefono', new.telefono),
    'mevak_contactos', new.id, auth.uid()
  );
  return new;
end $$;

drop trigger if exists trg_mevak_timeline_from_contacto on public.mevak_contactos;
create trigger trg_mevak_timeline_from_contacto
  after insert on public.mevak_contactos
  for each row execute function public.mevak_timeline_from_contacto();


-- Objetivos (insert + update; mevak_objetivos no tiene id, usamos client_id como source_id)
create or replace function public.mevak_timeline_from_objetivos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'objetivos',
    case when tg_op = 'INSERT' then 'Objetivos definidos' else 'Objetivos actualizados' end,
    left(coalesce(new.descripcion_md, ''), 240),
    jsonb_build_object('kpi_1', new.kpi_1, 'kpi_2', new.kpi_2, 'kpi_3', new.kpi_3),
    'mevak_objetivos', new.client_id, auth.uid()
  );
  return new;
end $$;

drop trigger if exists trg_mevak_timeline_from_objetivos on public.mevak_objetivos;
create trigger trg_mevak_timeline_from_objetivos
  after insert or update on public.mevak_objetivos
  for each row execute function public.mevak_timeline_from_objetivos();


-- Comentarios internos
create or replace function public.mevak_timeline_from_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'comentario_interno', 'Comentario interno',
    left(coalesce(new.contenido_md, ''), 240),
    jsonb_build_object('autor_id', new.autor_id),
    'mevak_comentarios_internos', new.id, coalesce(new.autor_id, auth.uid())
  );
  return new;
end $$;

drop trigger if exists trg_mevak_timeline_from_comentario on public.mevak_comentarios_internos;
create trigger trg_mevak_timeline_from_comentario
  after insert on public.mevak_comentarios_internos
  for each row execute function public.mevak_timeline_from_comentario();


-- ----- (3) PostgREST schema reload ------------------------------------------
notify pgrst, 'reload schema';
