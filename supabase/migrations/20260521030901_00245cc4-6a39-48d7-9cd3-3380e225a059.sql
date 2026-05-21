-- 1. Extender mevak_kpis_mensuales
alter table public.mevak_kpis_mensuales
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
  add column if not exists sesiones           integer,
  add column if not exists conversion_pct     numeric(6,3),
  add column if not exists ctr_pct            numeric(6,3),
  add column if not exists ads_spend          numeric(14,2),
  add column if not exists ads_revenue        numeric(14,2),
  add column if not exists roas               numeric(8,3)
    generated always as (
      case when ads_spend is not null and ads_spend > 0
           then ads_revenue / ads_spend else null end
    ) stored,
  add column if not exists top_productos      jsonb not null default '[]'::jsonb,
  add column if not exists sucursal_id        uuid references public.mevak_sucursales(id) on delete set null,
  add column if not exists source             text,
  add column if not exists notas              text,
  add column if not exists created_by         uuid references auth.users(id);

-- 2. Seed en mevak_app_settings (con tipo)
insert into public.mevak_app_settings (key, value, tipo) values
  ('mevak.reportes.mensual.portada_titulo', to_jsonb('Reporte mensual'::text), 'string'),
  ('mevak.reportes.mensual.portada_subtitulo', to_jsonb('Performance integral · Mevak Food Agency'::text), 'string'),
  ('mevak.reportes.mensual.footer', to_jsonb('mevak food agency · reporte mensual confidencial'::text), 'string'),
  ('mevak.reportes.mensual.seccion_kpis_titulo', to_jsonb('# KPIs del mes'::text), 'string'),
  ('mevak.reportes.mensual.seccion_digital_titulo', to_jsonb('# Performance digital'::text), 'string'),
  ('mevak.reportes.mensual.seccion_ads_titulo', to_jsonb('# Inversión publicitaria'::text), 'string'),
  ('mevak.reportes.mensual.seccion_productos_titulo', to_jsonb('# Top productos vendidos'::text), 'string'),
  ('mevak.reportes.mensual.seccion_promociones_titulo', to_jsonb('# Performance de promociones'::text), 'string'),
  ('mevak.reportes.mensual.seccion_roadmap_titulo', to_jsonb('# Roadmap y proyectos'::text), 'string'),
  ('mevak.reportes.mensual.seccion_insights_titulo', to_jsonb('# Insights y recomendaciones'::text), 'string'),
  ('mevak.reportes.mensual.seccion_conclusiones_titulo', to_jsonb('# Conclusiones y plan del próximo mes'::text), 'string'),
  ('mevak.reportes.mensual.insights_placeholder',
    '["Sostener el ritmo de ROAS por encima del benchmark de categoría.","Acelerar el roadmap de los proyectos bloqueados que vienen de meses anteriores.","Profundizar combos sobre los top 3 productos del mes para subir el ticket.","Auditar las promociones finalizadas con bajo impacto para reasignar presupuesto."]'::jsonb, 'json'),
  ('mevak.reportes.mensual.conclusiones_placeholder',
    '["Mes cerrado con cumplimiento sobre el plan acordado.","Continuamos con el foco trimestral en visibilidad y conversión.","Próximo mes: lanzar el calendario promocional revisado y avanzar el roadmap pendiente."]'::jsonb, 'json'),
  ('mevak.reportes.mensual.brand_colors',
    '{"royal":"#1E40AF","steel":"#475B7A","orange":"#E64A19","ink":"#0F172A","muted":"#64748B"}'::jsonb, 'json')
on conflict (key) do nothing;

-- 3. updated_at trigger
drop trigger if exists trg_mrm_touch on public.mevak_reportes_mensuales;
create trigger trg_mrm_touch before update on public.mevak_reportes_mensuales
  for each row execute function public.mevak_touch_updated_at();

-- 4. Trigger timeline
create or replace function public.mevak_timeline_from_reporte_mensual()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_titulo text; v_detalle text;
begin
  if (tg_op = 'INSERT') then
    v_titulo := 'Reporte mensual creado';
    v_detalle := format('Mes %s', to_char(new.month_start, 'YYYY-MM'));
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status
         and new.status in ('enviado','visto')) then
    v_titulo := case new.status when 'enviado' then 'Reporte mensual enviado'
                  else 'Reporte mensual visto por el cliente' end;
    v_detalle := format('Mes %s', to_char(new.month_start, 'YYYY-MM'));
  else return new; end if;
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'reporte_mensual', v_titulo, v_detalle,
    jsonb_build_object('month_start', new.month_start, 'status', new.status),
    'mevak_reportes_mensuales', new.id, auth.uid()
  );
  return new;
end $$;

drop trigger if exists trg_mevak_timeline_reporte_mensual_ins on public.mevak_reportes_mensuales;
create trigger trg_mevak_timeline_reporte_mensual_ins
  after insert on public.mevak_reportes_mensuales
  for each row execute function public.mevak_timeline_from_reporte_mensual();

drop trigger if exists trg_mevak_timeline_reporte_mensual_upd on public.mevak_reportes_mensuales;
create trigger trg_mevak_timeline_reporte_mensual_upd
  after update of status on public.mevak_reportes_mensuales
  for each row execute function public.mevak_timeline_from_reporte_mensual();

-- 5. RPCs
create or replace function public.mevak_upsert_kpi_mensual(
  _client_id uuid, _month_start date, _platform_id uuid, _sucursal_id uuid,
  _facturacion numeric, _ordenes integer, _demoras_min_prom numeric,
  _rechazos integer, _cancelaciones integer, _reviews_cantidad integer,
  _reviews_puntaje numeric, _open_time_pct numeric, _food_is_ready_min numeric,
  _sesiones integer, _conversion_pct numeric, _ctr_pct numeric,
  _ads_spend numeric, _ads_revenue numeric, _top_productos jsonb,
  _source text, _notas text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_month_start date := date_trunc('month', _month_start)::date;
begin
  if not public.mevak_can_write_client(auth.uid(), _client_id) then
    raise exception 'forbidden';
  end if;
  insert into public.mevak_kpis_mensuales(
    client_id, platform_id, sucursal_id, month_start,
    facturacion, ordenes, demoras_min_prom, rechazos, cancelaciones,
    reviews_cantidad, reviews_puntaje, open_time_pct, food_is_ready_min,
    sesiones, conversion_pct, ctr_pct, ads_spend, ads_revenue,
    top_productos, source, notas, created_by, metrics
  ) values (
    _client_id, _platform_id, _sucursal_id, v_month_start,
    _facturacion, _ordenes, _demoras_min_prom, _rechazos, _cancelaciones,
    _reviews_cantidad, _reviews_puntaje, _open_time_pct, _food_is_ready_min,
    _sesiones, _conversion_pct, _ctr_pct, _ads_spend, _ads_revenue,
    coalesce(_top_productos,'[]'::jsonb),
    coalesce(_source,'manual'), _notas, auth.uid(), '{}'::jsonb
  )
  on conflict (client_id, platform_id, month_start) do update set
    sucursal_id=excluded.sucursal_id, facturacion=excluded.facturacion,
    ordenes=excluded.ordenes, demoras_min_prom=excluded.demoras_min_prom,
    rechazos=excluded.rechazos, cancelaciones=excluded.cancelaciones,
    reviews_cantidad=excluded.reviews_cantidad, reviews_puntaje=excluded.reviews_puntaje,
    open_time_pct=excluded.open_time_pct, food_is_ready_min=excluded.food_is_ready_min,
    sesiones=excluded.sesiones, conversion_pct=excluded.conversion_pct,
    ctr_pct=excluded.ctr_pct, ads_spend=excluded.ads_spend,
    ads_revenue=excluded.ads_revenue, top_productos=excluded.top_productos,
    source=excluded.source, notas=excluded.notas
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.mevak_list_reportes_mensuales(_client_id uuid)
returns table (
  id uuid, month_start date, status public.mevak_reporte_status,
  summary text, pdf_url text, sent_at timestamptz, seen_at timestamptz,
  created_at timestamptz, created_by_email text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.month_start, r.status, r.summary, r.pdf_url,
         r.sent_at, r.seen_at, r.created_at,
         (select email::text from auth.users where id = r.created_by)
  from public.mevak_reportes_mensuales r
  where r.client_id = _client_id
    and public.mevak_can_access_client(auth.uid(), _client_id)
  order by r.month_start desc;
$$;

create or replace function public.mevak_kpis_mes_agg(_client_id uuid, _month_start date)
returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select * from public.mevak_kpis_mensuales
    where client_id = _client_id and month_start = _month_start
  ),
  totales as (
    select
      sum(facturacion) as facturacion,
      sum(ordenes)::int as ordenes,
      case when sum(ordenes) > 0 then sum(facturacion) / sum(ordenes) end as ticket_promedio,
      avg(demoras_min_prom) as demoras_min_prom,
      sum(rechazos)::int as rechazos,
      sum(cancelaciones)::int as cancelaciones,
      sum(reviews_cantidad)::int as reviews_cantidad,
      avg(reviews_puntaje) as reviews_puntaje,
      avg(open_time_pct) as open_time_pct,
      avg(food_is_ready_min) as food_is_ready_min,
      sum(sesiones)::int as sesiones,
      avg(conversion_pct) as conversion_pct,
      avg(ctr_pct) as ctr_pct,
      sum(ads_spend) as ads_spend,
      sum(ads_revenue) as ads_revenue,
      case when sum(ads_spend) > 0 then sum(ads_revenue) / sum(ads_spend) end as roas
    from base
  ),
  pp as (
    select coalesce(jsonb_agg(jsonb_build_object(
        'platform_id', b.platform_id, 'platform_name', p.name,
        'facturacion', b.facturacion, 'ordenes', b.ordenes,
        'ticket_promedio', b.ticket_promedio, 'open_time_pct', b.open_time_pct,
        'sesiones', b.sesiones, 'conversion_pct', b.conversion_pct,
        'ads_spend', b.ads_spend, 'roas', b.roas
      ) order by p.name nulls last), '[]'::jsonb) as por_plataforma
    from base b
    left join public.platforms p on p.id = b.platform_id
  ),
  tp as (
    select coalesce(jsonb_agg(elem order by (elem->>'revenue')::numeric desc nulls last), '[]'::jsonb) as top_productos
    from (
      select distinct on (lower(coalesce(e->>'nombre',''))) e as elem
      from base b, jsonb_array_elements(coalesce(b.top_productos,'[]'::jsonb)) e
      where coalesce(e->>'nombre','') <> ''
    ) x
  )
  select to_jsonb(t) || jsonb_build_object(
    'por_plataforma', pp.por_plataforma,
    'top_productos', tp.top_productos
  )
  from totales t, pp, tp;
$$;

create or replace function public.mevak_get_reporte_mensual_data(
  _client_id uuid, _month_start date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', _month_start)::date;
  v_prev_month date := (v_month - interval '1 month')::date;
  v_curr jsonb; v_prev jsonb; v_promos jsonb; v_roadmap jsonb;
  v_top_enriched jsonb; v_semanal jsonb;
begin
  if not public.mevak_can_access_client(auth.uid(), _client_id) then
    raise exception 'forbidden';
  end if;
  v_curr := public.mevak_kpis_mes_agg(_client_id, v_month);
  v_prev := public.mevak_kpis_mes_agg(_client_id, v_prev_month);

  with p as (
    select status, count(*)::int as n
    from public.mevak_promociones
    where client_id = _client_id
      and coalesce(starts_at, created_at::date) >= v_month
      and coalesce(starts_at, created_at::date) <  (v_month + interval '1 month')::date
    group by status
  ),
  detalle as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'nombre', nombre, 'status', status,
      'starts_at', starts_at, 'ends_at', ends_at
    ) order by coalesce(starts_at, created_at::date) desc), '[]'::jsonb) as items,
    count(*)::int as total
    from public.mevak_promociones
    where client_id = _client_id
      and coalesce(starts_at, created_at::date) >= v_month
      and coalesce(starts_at, created_at::date) <  (v_month + interval '1 month')::date
  )
  select jsonb_build_object(
    'total', (select total from detalle),
    'por_status', coalesce((select jsonb_object_agg(status::text, n) from p), '{}'::jsonb),
    'items', (select items from detalle)
  ) into v_promos;

  with r as (
    select status, count(*)::int as n
    from public.mevak_roadmap_items
    where client_id = _client_id
    group by status
  ),
  agg as (
    select sum(n)::int as total,
      coalesce(sum(n) filter (where status = 'completado'),0)::int as completados,
      coalesce(sum(n) filter (where status = 'en_progreso'),0)::int as en_progreso,
      coalesce(sum(n) filter (where status = 'bloqueado'),0)::int as bloqueados,
      coalesce(sum(n) filter (where status = 'backlog'),0)::int as backlog
    from r
  ),
  nuevos as (
    select count(*)::int as n from public.mevak_roadmap_items
    where client_id = _client_id and created_at >= v_month
      and created_at <  (v_month + interval '1 month')::date
  ),
  cerrados as (
    select count(*)::int as n from public.mevak_roadmap_items
    where client_id = _client_id and status = 'completado'
      and updated_at >= v_month and updated_at <  (v_month + interval '1 month')::date
  )
  select jsonb_build_object(
    'total', a.total, 'completados', a.completados,
    'en_progreso', a.en_progreso, 'bloqueados', a.bloqueados, 'backlog', a.backlog,
    'pct_completado', case when coalesce(a.total,0) = 0 then 0
           else round(a.completados::numeric * 100 / a.total, 1) end,
    'nuevos_en_mes', (select n from nuevos),
    'cerrados_en_mes', (select n from cerrados)
  ) into v_roadmap from agg a;

  with tp as (
    select e->>'nombre' as nombre,
           nullif(e->>'units','')::numeric as units,
           nullif(e->>'revenue','')::numeric as revenue
    from jsonb_array_elements(coalesce(v_curr->'top_productos','[]'::jsonb)) e
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'nombre', tp.nombre, 'units', tp.units, 'revenue', tp.revenue,
    'precio_menu', mi.precio, 'costo_menu', mi.costo,
    'foto_url', mi.foto_url, 'seccion', mi.seccion
  ) order by tp.revenue desc nulls last), '[]'::jsonb)
  into v_top_enriched
  from tp
  left join lateral (
    select precio, costo, foto_url, seccion
    from public.mevak_menu_items
    where client_id = _client_id and lower(nombre) = lower(tp.nombre)
    limit 1
  ) mi on true;

  with weeks as (
    select date_trunc('week', generate_series(
      v_month, (v_month + interval '1 month - 1 day')::date, '1 week'
    ))::date as wk
  ),
  data as (
    select date_trunc('week', week_start)::date as wk,
           sum(facturacion) as facturacion, sum(ordenes)::int as ordenes
    from public.mevak_kpis_semanales
    where client_id = _client_id and week_start >= v_month
      and week_start <  (v_month + interval '1 month')::date
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'week_start', w.wk,
    'facturacion', coalesce(d.facturacion, 0),
    'ordenes', coalesce(d.ordenes, 0)
  ) order by w.wk), '[]'::jsonb)
  into v_semanal
  from (select distinct wk from weeks) w
  left join data d using (wk);

  return jsonb_build_object(
    'client_id', _client_id, 'month_start', v_month,
    'prev_month_start', v_prev_month,
    'current', coalesce(v_curr, '{}'::jsonb)
      || jsonb_build_object('top_productos', coalesce(v_top_enriched, '[]'::jsonb)),
    'previous', coalesce(v_prev, '{}'::jsonb),
    'promociones', coalesce(v_promos, '{}'::jsonb),
    'roadmap', coalesce(v_roadmap, '{}'::jsonb),
    'semanal_serie', coalesce(v_semanal, '[]'::jsonb)
  );
end $$;

create or replace function public.mevak_create_reporte_mensual(
  _client_id uuid, _month_start date, _content jsonb, _summary text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_month date := date_trunc('month', _month_start)::date;
begin
  if not public.mevak_can_write_client(auth.uid(), _client_id) then
    raise exception 'forbidden';
  end if;
  insert into public.mevak_reportes_mensuales(
    client_id, month_start, status, content, summary, created_by
  ) values (
    _client_id, v_month, 'borrador',
    coalesce(_content,'{}'::jsonb), _summary, auth.uid()
  )
  on conflict (client_id, month_start) do update set
    content = excluded.content, summary = excluded.summary
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.mevak_set_reporte_mensual_status(
  _id uuid, _status public.mevak_reporte_status, _pdf_url text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  select client_id into v_client from public.mevak_reportes_mensuales where id = _id;
  if v_client is null then raise exception 'not found'; end if;
  if _status = 'visto' then
    if not public.mevak_can_access_client(auth.uid(), v_client) then
      raise exception 'forbidden';
    end if;
    update public.mevak_reportes_mensuales
       set status = _status,
           seen_at = coalesce(seen_at, now()),
           pdf_url = coalesce(_pdf_url, pdf_url)
     where id = _id;
  else
    if not public.mevak_can_write_client(auth.uid(), v_client) then
      raise exception 'forbidden';
    end if;
    update public.mevak_reportes_mensuales
       set status = _status,
           sent_at = case when _status = 'enviado' then now() else sent_at end,
           pdf_url = coalesce(_pdf_url, pdf_url)
     where id = _id;
  end if;
end $$;

-- 6. Tightening
revoke all on function public.mevak_upsert_kpi_mensual(uuid,date,uuid,uuid,numeric,integer,numeric,integer,integer,integer,numeric,numeric,numeric,integer,numeric,numeric,numeric,numeric,jsonb,text,text) from public, anon;
grant execute on function public.mevak_upsert_kpi_mensual(uuid,date,uuid,uuid,numeric,integer,numeric,integer,integer,integer,numeric,numeric,numeric,integer,numeric,numeric,numeric,numeric,jsonb,text,text) to authenticated;

revoke all on function public.mevak_list_reportes_mensuales(uuid) from public, anon;
grant execute on function public.mevak_list_reportes_mensuales(uuid) to authenticated;

revoke all on function public.mevak_kpis_mes_agg(uuid,date) from public, anon;
grant execute on function public.mevak_kpis_mes_agg(uuid,date) to authenticated;

revoke all on function public.mevak_get_reporte_mensual_data(uuid,date) from public, anon;
grant execute on function public.mevak_get_reporte_mensual_data(uuid,date) to authenticated;

revoke all on function public.mevak_create_reporte_mensual(uuid,date,jsonb,text) from public, anon;
grant execute on function public.mevak_create_reporte_mensual(uuid,date,jsonb,text) to authenticated;

revoke all on function public.mevak_set_reporte_mensual_status(uuid,public.mevak_reporte_status,text) from public, anon;
grant execute on function public.mevak_set_reporte_mensual_status(uuid,public.mevak_reporte_status,text) to authenticated;

notify pgrst, 'reload schema';