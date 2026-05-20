-- d2: menu, promociones extension, fotos, storage, timeline triggers, RPCs
do $$ begin
  alter type public.mevak_promocion_status add value if not exists 'propuesta' before 'planificada';
exception when others then null; end $$;
do $$ begin
  alter type public.mevak_promocion_status add value if not exists 'aprobada_offline' before 'activa';
exception when others then null; end $$;
do $$ begin
  alter type public.mevak_promocion_status add value if not exists 'cargada_en_plataformas' before 'activa';
exception when others then null; end $$;

alter table public.mevak_promociones
  add column if not exists sucursal_id uuid references public.mevak_sucursales(id) on delete set null,
  add column if not exists aprobada_at timestamptz,
  add column if not exists aprobada_by uuid references auth.users(id);

create index if not exists idx_mpromo_status on public.mevak_promociones(client_id, status, starts_at desc);

create table if not exists public.mevak_menu_uploads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_sub_brand_id uuid references public.client_sub_brands(id) on delete set null,
  storage_path text,
  filename text,
  row_count int not null default 0,
  uploaded_by uuid references auth.users(id),
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_mmu_client on public.mevak_menu_uploads(client_id, created_at desc);

create table if not exists public.mevak_menu_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_sub_brand_id uuid references public.client_sub_brands(id) on delete set null,
  upload_id uuid references public.mevak_menu_uploads(id) on delete set null,
  seccion text,
  nombre text not null,
  descripcion text,
  precio numeric(12,2),
  costo numeric(12,2),
  opcionales jsonb not null default '[]'::jsonb,
  combos jsonb not null default '[]'::jsonb,
  foto_url text,
  stock_estado text,
  promo_vinculada text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mmi_client on public.mevak_menu_items(client_id, client_sub_brand_id);
create index if not exists idx_mmi_upload on public.mevak_menu_items(upload_id);

create table if not exists public.mevak_fotos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  storage_path text not null,
  filename text,
  mime_type text,
  size_bytes bigint,
  tags text[] not null default array[]::text[],
  drive_url text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_mfo_client on public.mevak_fotos(client_id, created_at desc);
create index if not exists idx_mfo_tags on public.mevak_fotos using gin(tags);

alter table public.mevak_menu_uploads enable row level security;
alter table public.mevak_menu_items   enable row level security;
alter table public.mevak_fotos        enable row level security;

do $$
declare
  t text;
  tables text[] := array['mevak_menu_uploads','mevak_menu_items','mevak_fotos'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.mevak_can_access_client(auth.uid(), client_id))', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.mevak_can_write_client(auth.uid(), client_id)) with check (public.mevak_can_write_client(auth.uid(), client_id))', t || '_write', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public) values ('mevak-catalogos','mevak-catalogos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('mevak-fotos','mevak-fotos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('mevak-documentos','mevak-documentos', false) on conflict (id) do nothing;

do $$
declare
  b text;
  buckets text[] := array['mevak-catalogos','mevak-fotos','mevak-documentos'];
begin
  foreach b in array buckets loop
    execute format('drop policy if exists %I on storage.objects', 'mevak_storage_read_' || b);
    execute format($f$create policy %I on storage.objects for select to authenticated using (bucket_id = %L and public.mevak_can_access_client(auth.uid(), nullif(split_part(name, '/', 1), '')::uuid))$f$, 'mevak_storage_read_' || b, b);
    execute format('drop policy if exists %I on storage.objects', 'mevak_storage_write_' || b);
    execute format($f$create policy %I on storage.objects for all to authenticated using (bucket_id = %L and public.mevak_can_write_client(auth.uid(), nullif(split_part(name, '/', 1), '')::uuid)) with check (bucket_id = %L and public.mevak_can_write_client(auth.uid(), nullif(split_part(name, '/', 1), '')::uuid))$f$, 'mevak_storage_write_' || b, b, b);
  end loop;
end $$;

create or replace function public.mevak_timeline_from_menu_upload()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'menu_upload', 'Menú actualizado',
    coalesce(new.filename, 'Carga manual') || format(' (%s ítems)', new.row_count),
    jsonb_build_object('upload_id', new.id, 'row_count', new.row_count, 'sub_brand_id', new.client_sub_brand_id),
    'mevak_menu_uploads', new.id, auth.uid()
  );
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_menu_upload on public.mevak_menu_uploads;
create trigger trg_mevak_timeline_menu_upload after insert on public.mevak_menu_uploads
  for each row execute function public.mevak_timeline_from_menu_upload();

create or replace function public.mevak_timeline_from_promocion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.mevak_timeline_eventos(
      client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
    ) values (
      new.client_id, 'promocion', 'Promo creada: ' || new.nombre, coalesce(new.descripcion, ''),
      jsonb_build_object('status', new.status, 'starts_at', new.starts_at, 'ends_at', new.ends_at),
      'mevak_promociones', new.id, auth.uid()
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.mevak_timeline_eventos(
      client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
    ) values (
      new.client_id, 'promocion', 'Promo "' || new.nombre || '": ' || new.status,
      format('%s → %s', old.status, new.status),
      jsonb_build_object('from', old.status, 'to', new.status),
      'mevak_promociones', new.id, auth.uid()
    );
  end if;
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_promocion on public.mevak_promociones;
create trigger trg_mevak_timeline_promocion after insert or update on public.mevak_promociones
  for each row execute function public.mevak_timeline_from_promocion();

create or replace function public.mevak_timeline_from_foto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mevak_timeline_eventos(
    client_id, tipo, titulo, detalle, payload, source_table, source_id, actor_id
  ) values (
    new.client_id, 'material_visual', 'Material visual subido', coalesce(new.filename, 'foto'),
    jsonb_build_object('tags', new.tags, 'storage_path', new.storage_path),
    'mevak_fotos', new.id, auth.uid()
  );
  return new;
end $$;
drop trigger if exists trg_mevak_timeline_foto on public.mevak_fotos;
create trigger trg_mevak_timeline_foto after insert on public.mevak_fotos
  for each row execute function public.mevak_timeline_from_foto();

create or replace function public.mevak_list_menu_items(_client_id uuid)
returns table (id uuid, client_sub_brand_id uuid, sub_brand_name text, upload_id uuid, seccion text, nombre text, descripcion text, precio numeric, costo numeric, foto_url text, stock_estado text, promo_vinculada text, opcionales jsonb, combos jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mi.id, mi.client_sub_brand_id, sb.name::text, mi.upload_id, mi.seccion, mi.nombre, mi.descripcion, mi.precio, mi.costo,
         mi.foto_url, mi.stock_estado, mi.promo_vinculada, mi.opcionales, mi.combos, mi.created_at
    from public.mevak_menu_items mi
    left join public.client_sub_brands sb on sb.id = mi.client_sub_brand_id
   where mi.client_id = _client_id and public.mevak_can_access_client(auth.uid(), _client_id)
   order by mi.seccion nulls last, mi.nombre;
$$;

create or replace function public.mevak_get_menu_score(_client_id uuid)
returns table (total_items int, score int, pct_descripcion int, pct_foto int, pct_precio int, pct_costo int, last_upload_at timestamptz, last_upload_by text)
language sql stable security definer set search_path = public as $$
  with items as (select * from public.mevak_menu_items where client_id = _client_id),
  agg as (
    select count(*)::int as n,
      sum(case when coalesce(descripcion,'') <> '' then 1 else 0 end)::int as nd,
      sum(case when coalesce(foto_url,'') <> '' then 1 else 0 end)::int as nf,
      sum(case when precio is not null then 1 else 0 end)::int as np,
      sum(case when costo is not null then 1 else 0 end)::int as nc
    from items
  ),
  last_up as (
    select mu.created_at, u.email::text as email
      from public.mevak_menu_uploads mu
      left join auth.users u on u.id = mu.uploaded_by
     where mu.client_id = _client_id
     order by mu.created_at desc limit 1
  )
  select coalesce(a.n, 0),
    case when coalesce(a.n,0) = 0 then 0 else (((a.nd + a.nf + a.np + a.nc)::numeric / (4 * a.n)) * 100)::int end,
    case when coalesce(a.n,0) = 0 then 0 else (a.nd * 100 / a.n) end,
    case when coalesce(a.n,0) = 0 then 0 else (a.nf * 100 / a.n) end,
    case when coalesce(a.n,0) = 0 then 0 else (a.np * 100 / a.n) end,
    case when coalesce(a.n,0) = 0 then 0 else (a.nc * 100 / a.n) end,
    (select created_at from last_up), (select email from last_up)
  from agg a
  where public.mevak_can_access_client(auth.uid(), _client_id);
$$;

create or replace function public.mevak_list_menu_uploads(_client_id uuid)
returns table (id uuid, filename text, storage_path text, row_count int, sub_brand_name text, uploaded_by_email text, notas text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mu.id, mu.filename, mu.storage_path, mu.row_count, sb.name::text, u.email::text, mu.notas, mu.created_at
    from public.mevak_menu_uploads mu
    left join public.client_sub_brands sb on sb.id = mu.client_sub_brand_id
    left join auth.users u on u.id = mu.uploaded_by
   where mu.client_id = _client_id and public.mevak_can_access_client(auth.uid(), _client_id)
   order by mu.created_at desc;
$$;

create or replace function public.mevak_list_promociones(_client_id uuid)
returns table (id uuid, nombre text, descripcion text, status public.mevak_promocion_status, platform_id uuid, platform_name text, sub_brand_id uuid, sub_brand_name text, sucursal_id uuid, sucursal_nombre text, starts_at date, ends_at date, aprobada_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.descripcion, p.status, p.platform_id, pl.name::text, p.sub_brand_id, sb.name::text,
         p.sucursal_id, su.nombre::text, p.starts_at, p.ends_at, p.aprobada_at, p.created_at
    from public.mevak_promociones p
    left join public.platforms pl on pl.id = p.platform_id
    left join public.client_sub_brands sb on sb.id = p.sub_brand_id
    left join public.mevak_sucursales su on su.id = p.sucursal_id
   where p.client_id = _client_id and public.mevak_can_access_client(auth.uid(), _client_id)
   order by coalesce(p.starts_at, p.created_at::date) desc;
$$;

create or replace function public.mevak_list_fotos(_client_id uuid)
returns table (id uuid, storage_path text, filename text, mime_type text, size_bytes bigint, tags text[], drive_url text, uploaded_by_email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.storage_path, f.filename, f.mime_type, f.size_bytes, f.tags, f.drive_url, u.email::text, f.created_at
    from public.mevak_fotos f
    left join auth.users u on u.id = f.uploaded_by
   where f.client_id = _client_id and public.mevak_can_access_client(auth.uid(), _client_id)
   order by f.created_at desc;
$$;

revoke all on function public.mevak_list_menu_items(uuid) from public, anon;
revoke all on function public.mevak_get_menu_score(uuid) from public, anon;
revoke all on function public.mevak_list_menu_uploads(uuid) from public, anon;
revoke all on function public.mevak_list_promociones(uuid) from public, anon;
revoke all on function public.mevak_list_fotos(uuid) from public, anon;

grant execute on function public.mevak_list_menu_items(uuid)   to authenticated;
grant execute on function public.mevak_get_menu_score(uuid)    to authenticated;
grant execute on function public.mevak_list_menu_uploads(uuid) to authenticated;
grant execute on function public.mevak_list_promociones(uuid)  to authenticated;
grant execute on function public.mevak_list_fotos(uuid)        to authenticated;

notify pgrst, 'reload schema';