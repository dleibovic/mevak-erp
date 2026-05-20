-- 1. Extender mevak_kpis_semanales
alter table public.mevak_kpis_semanales
  add column if not exists facturacion        numeric(14,2),
  add column if not exists ordenes            integer,
  add column if not exists ticket_promedio    numeric(12,2)
    generated always as (
      case when ordenes is not null and ordenes > 0
           then facturacion / ordenes else null end
    ) stored,
  add column if not exists demoras_min_prom   numeric(8,2),
  add column if not exists rechazos           integer,
  add column if not exists cancelaciones      integer,
  add column if not exists reviews_cantidad   integer,
  add column if not exists reviews_puntaje    numeric(4,2),
  add column if not exists open_time_pct      numeric(5,2),
  add column if not exists food_is_ready_min  numeric(8,2),
  add column if not exists sucursal_id        uuid references public.mevak_sucursales(id) on delete set null,
  add column if not exists source             text,
  add column if not exists notas              text,
  add column if not exists created_by         uuid references auth.users(id);

-- 2. Seed mevak_app_settings (namespace mevak.reportes.semanal.*)
insert into public.mevak_app_settings (key, value, tipo, description) values
  ('mevak.reportes.semanal.portada_titulo', to_jsonb('Reporte semanal'::text), 'string', 'Título de portada del reporte semanal'),
  ('mevak.reportes.semanal.portada_subtitulo', to_jsonb('Performance multiplataforma · Mevak Food Agency'::text), 'string', 'Subtítulo de portada'),
  ('mevak.reportes.semanal.footer', to_jsonb('mevak food agency · reporte confidencial'::text), 'string', 'Footer del reporte'),
  ('mevak.reportes.semanal.seccion_kpis_titulo', to_jsonb('# KPIs de la semana'::text), 'string', 'Título sección KPIs'),
  ('mevak.reportes.semanal.seccion_comparativa_titulo', to_jsonb('# Comparativa vs semana anterior'::text), 'string', 'Título sección comparativa'),
  ('mevak.reportes.semanal.seccion_proyeccion_titulo', to_jsonb('# Proyección de cierre mensual'::text), 'string', 'Título sección proyección'),
  ('mevak.reportes.semanal.seccion_insights_titulo', to_jsonb('# Insights y recomendaciones'::text), 'string', 'Título sección insights'),
  ('mevak.reportes.semanal.insights_placeholder',
    '["Mantener el ritmo de promociones que viene impactando el ticket promedio.",
      "Revisar tiempos de Food is Ready en horarios pico para reducir demoras.",
      "Sostener el Open Time por encima del 95% — está correlacionando con mejor puntaje.",
      "Foco en respuesta a reviews negativas dentro de las primeras 24 horas."]'::jsonb,
    'json', 'Insights placeholder para reportes nuevos'),
  ('mevak.reportes.semanal.brand_colors',
    '{"royal":"#1E40AF","steel":"#475B7A","orange":"#E64A19","ink":"#0F172A","muted":"#64748B"}'::jsonb,
    'json', 'Paleta de colores del reporte')
on conflict (key) do nothing;

-- 3. updated_at touch
create or replace function public.mevak_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_mrs_touch on public.mevak_reportes_semanales;
create trigger trg_mrs_touch before update on public.mevak_reportes_semanales
  for each row execute function public.mevak_touch_updated_at();

-- 4. Timeline trigger
create or replace function public.mevak_timeline_from_reporte_semanal()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_titulo text; v_detalle text;
begin
  if (tg_op = 'INSERT') then
    v_titulo := 'Reporte semanal creado';
    v_detalle := format('Semana del %s', to_char(new.week_start, 'YYYY-MM-DD'));
  elsif (tg_op = 'UPDATE'
         and new.status is distinct from old.status
         and new.status in ('enviado','visto')) then
    v_titulo := case new.status
                  when 'enviado' then 'Reporte semanal enviado'
                  else 'Reporte semanal visto por el cliente' end;
    v_detalle := format('Semana del %s', to_char(new.week_start, 'YYYY-MM-DD'));
  else
    return new;
  end if;
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'reporte_semanal', v_titulo, v_detalle,
    jsonb_build_object('week_start', new.week_start, 'status', new.status),
    'mevak_reportes_semanales', new.id, auth.uid()
  );
  return new;
end $$;

drop trigger if exists trg_mevak_timeline_reporte_semanal_ins on public.mevak_reportes_semanales;
create trigger trg_mevak_timeline_reporte_semanal_ins
  after insert on public.mevak_reportes_semanales
  for each row execute function public.mevak_timeline_from_reporte_semanal();

drop trigger if exists trg_mevak_timeline_reporte_semanal_upd on public.mevak_reportes_semanales;
create trigger trg_mevak_timeline_reporte_semanal_upd
  after update of status on public.mevak_reportes_semanales
  for each row execute function public.mevak_timeline_from_reporte_semanal();

-- 5.1 Upsert KPI
create or replace function public.mevak_upsert_kpi_semanal(
  _client_id uuid, _week_start date, _platform_id uuid, _sucursal_id uuid,
  _facturacion numeric, _ordenes integer, _demoras_min_prom numeric,
  _rechazos integer, _cancelaciones integer, _reviews_cantidad integer,
  _reviews_puntaje numeric, _open_time_pct numeric, _food_is_ready_min numeric,
  _source text, _notas text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.mevak_can_write_client(auth.uid(), _client_id) then raise exception 'forbidden'; end if;
  insert into public.mevak_kpis_semanales(
    client_id, platform_id, sucursal_id, week_start,
    facturacion, ordenes, demoras_min_prom, rechazos, cancelaciones,
    reviews_cantidad, reviews_puntaje, open_time_pct, food_is_ready_min,
    source, notas, created_by, metrics
  ) values (
    _client_id, _platform_id, _sucursal_id, _week_start,
    _facturacion, _ordenes, _demoras_min_prom, _rechazos, _cancelaciones,
    _reviews_cantidad, _reviews_puntaje, _open_time_pct, _food_is_ready_min,
    coalesce(_source,'manual'), _notas, auth.uid(), '{}'::jsonb
  )
  on conflict (client_id, platform_id, week_start) do update set
    sucursal_id=excluded.sucursal_id, facturacion=excluded.facturacion,
    ordenes=excluded.ordenes, demoras_min_prom=excluded.demoras_min_prom,
    rechazos=excluded.rechazos, cancelaciones=excluded.cancelaciones,
    reviews_cantidad=excluded.reviews_cantidad, reviews_puntaje=excluded.reviews_puntaje,
    open_time_pct=excluded.open_time_pct, food_is_ready_min=excluded.food_is_ready_min,
    source=excluded.source, notas=excluded.notas
  returning id into v_id;
  return v_id;
end $$;

-- 5.2 List reportes
create or replace function public.mevak_list_reportes_semanales(_client_id uuid)
returns table (
  id uuid, week_start date, status public.mevak_reporte_status, summary text, pdf_url text,
  sent_at timestamptz, seen_at timestamptz, created_at timestamptz, created_by_email text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.week_start, r.status, r.summary, r.pdf_url,
         r.sent_at, r.seen_at, r.created_at,
         (select email::text from auth.users where id = r.created_by)
  from public.mevak_reportes_semanales r
  where r.client_id = _client_id
    and public.mevak_can_access_client(auth.uid(), _client_id)
  order by r.week_start desc;
$$;

-- 5.3 Aggregate
create or replace function public.mevak_kpis_semana_agg(_client_id uuid, _week_start date)
returns table (
  facturacion numeric, ordenes integer, ticket_promedio numeric,
  demoras_min_prom numeric, rechazos integer, cancelaciones integer,
  reviews_cantidad integer, reviews_puntaje numeric,
  open_time_pct numeric, food_is_ready_min numeric, por_plataforma jsonb
)
language sql stable security definer set search_path = public as $$
  with base as (
    select * from public.mevak_kpis_semanales
    where client_id = _client_id and week_start = _week_start
  ),
  totales as (
    select sum(facturacion) as facturacion, sum(ordenes)::int as ordenes,
      case when sum(ordenes) > 0 then sum(facturacion) / sum(ordenes) end as ticket_promedio,
      avg(demoras_min_prom) as demoras_min_prom,
      sum(rechazos)::int as rechazos, sum(cancelaciones)::int as cancelaciones,
      sum(reviews_cantidad)::int as reviews_cantidad, avg(reviews_puntaje) as reviews_puntaje,
      avg(open_time_pct) as open_time_pct, avg(food_is_ready_min) as food_is_ready_min
    from base
  ),
  pp as (
    select coalesce(jsonb_agg(jsonb_build_object(
        'platform_id', b.platform_id, 'platform_name', p.name,
        'facturacion', b.facturacion, 'ordenes', b.ordenes,
        'ticket_promedio', b.ticket_promedio,
        'open_time_pct', b.open_time_pct, 'food_is_ready_min', b.food_is_ready_min,
        'reviews_puntaje', b.reviews_puntaje
      ) order by p.name nulls last), '[]'::jsonb) as por_plataforma
    from base b
    left join public.platforms p on p.id = b.platform_id
  )
  select t.*, pp.por_plataforma from totales t, pp;
$$;

-- 5.4 Get reporte data
create or replace function public.mevak_get_reporte_semanal_data(
  _client_id uuid, _week_start date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_prev_week date := _week_start - interval '7 days';
  v_month_start date := date_trunc('month', _week_start)::date;
  v_curr jsonb; v_prev jsonb; v_mes jsonb;
  v_weeks_in_month int; v_weeks_loaded int; v_proyeccion jsonb;
begin
  if not public.mevak_can_access_client(auth.uid(), _client_id) then raise exception 'forbidden'; end if;
  select to_jsonb(t) into v_curr from public.mevak_kpis_semana_agg(_client_id, _week_start) t;
  select to_jsonb(t) into v_prev from public.mevak_kpis_semana_agg(_client_id, v_prev_week) t;
  with mes as (
    select sum(facturacion) as facturacion, sum(ordenes)::int as ordenes,
      case when sum(ordenes) > 0 then sum(facturacion) / sum(ordenes) end as ticket_promedio,
      sum(rechazos)::int as rechazos, sum(cancelaciones)::int as cancelaciones,
      avg(open_time_pct) as open_time_pct, avg(reviews_puntaje) as reviews_puntaje
    from public.mevak_kpis_semanales
    where client_id = _client_id and week_start >= v_month_start and week_start <= _week_start
  )
  select to_jsonb(m) into v_mes from mes m;
  v_weeks_in_month := 5;
  select count(distinct week_start)::int into v_weeks_loaded
    from public.mevak_kpis_semanales
    where client_id = _client_id and week_start >= v_month_start and week_start <= _week_start;
  if v_weeks_loaded > 0 then
    v_proyeccion := jsonb_build_object(
      'weeks_loaded', v_weeks_loaded, 'weeks_in_month', v_weeks_in_month,
      'facturacion_proyectada', (v_mes->>'facturacion')::numeric / v_weeks_loaded * v_weeks_in_month,
      'ordenes_proyectadas', round((v_mes->>'ordenes')::numeric / v_weeks_loaded * v_weeks_in_month)
    );
  else v_proyeccion := '{}'::jsonb; end if;
  return jsonb_build_object(
    'client_id', _client_id, 'week_start', _week_start,
    'prev_week_start', v_prev_week, 'month_start', v_month_start,
    'current', coalesce(v_curr, '{}'::jsonb), 'previous', coalesce(v_prev, '{}'::jsonb),
    'mes_acumulado', coalesce(v_mes, '{}'::jsonb), 'proyeccion', v_proyeccion
  );
end $$;

-- 5.5 Create reporte
create or replace function public.mevak_create_reporte_semanal(
  _client_id uuid, _week_start date, _content jsonb, _summary text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.mevak_can_write_client(auth.uid(), _client_id) then raise exception 'forbidden'; end if;
  insert into public.mevak_reportes_semanales(
    client_id, week_start, status, content, summary, created_by
  ) values (
    _client_id, _week_start, 'borrador', coalesce(_content,'{}'::jsonb), _summary, auth.uid()
  )
  on conflict (client_id, week_start) do update set
    content = excluded.content, summary = excluded.summary
  returning id into v_id;
  return v_id;
end $$;

-- 5.6 Set status
create or replace function public.mevak_set_reporte_semanal_status(
  _id uuid, _status public.mevak_reporte_status, _pdf_url text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  select client_id into v_client from public.mevak_reportes_semanales where id = _id;
  if v_client is null then raise exception 'not found'; end if;
  if _status = 'visto' then
    if not public.mevak_can_access_client(auth.uid(), v_client) then raise exception 'forbidden'; end if;
    update public.mevak_reportes_semanales
       set status = _status, seen_at = coalesce(seen_at, now()),
           pdf_url = coalesce(_pdf_url, pdf_url)
     where id = _id;
  else
    if not public.mevak_can_write_client(auth.uid(), v_client) then raise exception 'forbidden'; end if;
    update public.mevak_reportes_semanales
       set status = _status,
           sent_at = case when _status = 'enviado' then now() else sent_at end,
           pdf_url = coalesce(_pdf_url, pdf_url)
     where id = _id;
  end if;
end $$;

-- 5.7 Get settings
create or replace function public.mevak_get_reportes_settings()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(replace(key,'mevak.reportes.',''), value), '{}'::jsonb)
  from public.mevak_app_settings
  where key like 'mevak.reportes.%';
$$;

-- Tightening
revoke all on function public.mevak_upsert_kpi_semanal(uuid,date,uuid,uuid,numeric,integer,numeric,integer,integer,integer,numeric,numeric,numeric,text,text) from public, anon;
grant execute on function public.mevak_upsert_kpi_semanal(uuid,date,uuid,uuid,numeric,integer,numeric,integer,integer,integer,numeric,numeric,numeric,text,text) to authenticated;

revoke all on function public.mevak_list_reportes_semanales(uuid) from public, anon;
grant execute on function public.mevak_list_reportes_semanales(uuid) to authenticated;

revoke all on function public.mevak_kpis_semana_agg(uuid,date) from public, anon;
grant execute on function public.mevak_kpis_semana_agg(uuid,date) to authenticated;

revoke all on function public.mevak_get_reporte_semanal_data(uuid,date) from public, anon;
grant execute on function public.mevak_get_reporte_semanal_data(uuid,date) to authenticated;

revoke all on function public.mevak_create_reporte_semanal(uuid,date,jsonb,text) from public, anon;
grant execute on function public.mevak_create_reporte_semanal(uuid,date,jsonb,text) to authenticated;

revoke all on function public.mevak_set_reporte_semanal_status(uuid,public.mevak_reporte_status,text) from public, anon;
grant execute on function public.mevak_set_reporte_semanal_status(uuid,public.mevak_reporte_status,text) to authenticated;

revoke all on function public.mevak_get_reportes_settings() from public, anon;
grant execute on function public.mevak_get_reportes_settings() to authenticated;

notify pgrst, 'reload schema';