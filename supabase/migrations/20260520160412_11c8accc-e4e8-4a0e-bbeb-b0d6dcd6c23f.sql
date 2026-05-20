
-- 0. Enums
do $$ begin create type public.mevak_cliente_user_role as enum ('cliente_user', 'ejecutivo_asignado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_reporte_status as enum ('borrador', 'enviado', 'visto', 'archivado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_kpi_period as enum ('semanal', 'mensual'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_promocion_status as enum ('planificada', 'activa', 'finalizada', 'cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_roadmap_item_status as enum ('backlog', 'en_progreso', 'bloqueado', 'completado', 'descartado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_reunion_status as enum ('agendada', 'realizada', 'cancelada', 'reprogramada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_tarea_status as enum ('pendiente', 'en_progreso', 'completada', 'cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_tarea_priority as enum ('baja', 'media', 'alta', 'urgente'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_alerta_severity as enum ('info', 'warning', 'critical'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_alerta_status as enum ('abierta', 'reconocida', 'resuelta', 'descartada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_wa_direction as enum ('inbound', 'outbound'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_onboarding_item_status as enum ('pendiente', 'en_progreso', 'completado', 'no_aplica'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_ai_message_role as enum ('system', 'user', 'assistant', 'tool'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mevak_ai_feedback as enum ('up', 'down'); exception when duplicate_object then null; end $$;

-- 1. Pivote
create table if not exists public.mevak_cliente_usuarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  role public.mevak_cliente_user_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, client_id, role)
);
create index if not exists idx_mevak_cliente_usuarios_user on public.mevak_cliente_usuarios(user_id);
create index if not exists idx_mevak_cliente_usuarios_client on public.mevak_cliente_usuarios(client_id);

-- 2. Helpers
create or replace function public.mevak_can_access_client(_user_id uuid, _client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_mevak_role(_user_id, 'direccion'::public.mevak_role)
    or exists (select 1 from public.mevak_cliente_usuarios where user_id = _user_id and client_id = _client_id);
$$;

create or replace function public.mevak_my_client_ids(_user_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select client_id from public.mevak_cliente_usuarios where user_id = _user_id;
$$;

create or replace function public.mevak_can_write_client(_user_id uuid, _client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_mevak_role(_user_id, 'direccion'::public.mevak_role)
    or (
      public.has_mevak_role(_user_id, 'ejecutivo'::public.mevak_role)
      and exists (
        select 1 from public.mevak_cliente_usuarios
        where user_id = _user_id and client_id = _client_id and role = 'ejecutivo_asignado'
      )
    );
$$;

create or replace function public.mevak_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

revoke execute on function public.mevak_can_access_client(uuid, uuid) from public, anon;
revoke execute on function public.mevak_can_write_client(uuid, uuid) from public, anon;
revoke execute on function public.mevak_my_client_ids(uuid) from public, anon;
grant execute on function public.mevak_can_access_client(uuid, uuid) to authenticated;
grant execute on function public.mevak_can_write_client(uuid, uuid) to authenticated;
grant execute on function public.mevak_my_client_ids(uuid) to authenticated;

-- 3. RLS pivote
alter table public.mevak_cliente_usuarios enable row level security;
drop policy if exists "mcu_select" on public.mevak_cliente_usuarios;
create policy "mcu_select" on public.mevak_cliente_usuarios for select to authenticated using (
  user_id = auth.uid()
  or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role)
  or (public.has_mevak_role(auth.uid(), 'ejecutivo'::public.mevak_role)
      and client_id in (select public.mevak_my_client_ids(auth.uid())))
);
drop policy if exists "mcu_write_direccion" on public.mevak_cliente_usuarios;
create policy "mcu_write_direccion" on public.mevak_cliente_usuarios for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))
  with check (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

-- 4. Tablas operacionales
create table if not exists public.mevak_reportes_semanales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start date not null,
  status public.mevak_reporte_status not null default 'borrador',
  content jsonb not null default '{}'::jsonb,
  summary text, pdf_url text,
  created_by uuid references auth.users(id),
  sent_at timestamptz, seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start)
);
create index if not exists idx_mrs_client_week on public.mevak_reportes_semanales(client_id, week_start desc);

create table if not exists public.mevak_reportes_mensuales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  month_start date not null,
  status public.mevak_reporte_status not null default 'borrador',
  content jsonb not null default '{}'::jsonb,
  summary text, pdf_url text,
  created_by uuid references auth.users(id),
  sent_at timestamptz, seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month_start)
);
create index if not exists idx_mrm_client_month on public.mevak_reportes_mensuales(client_id, month_start desc);

create table if not exists public.mevak_kpis_semanales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform_id uuid references public.platforms(id) on delete set null,
  week_start date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (client_id, platform_id, week_start)
);
create index if not exists idx_mks_client_week on public.mevak_kpis_semanales(client_id, week_start desc);

create table if not exists public.mevak_kpis_mensuales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform_id uuid references public.platforms(id) on delete set null,
  month_start date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (client_id, platform_id, month_start)
);
create index if not exists idx_mkm_client_month on public.mevak_kpis_mensuales(client_id, month_start desc);

create table if not exists public.mevak_promociones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform_id uuid references public.platforms(id) on delete set null,
  sub_brand_id uuid references public.client_sub_brands(id) on delete set null,
  nombre text not null, descripcion text,
  status public.mevak_promocion_status not null default 'planificada',
  starts_at date, ends_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mpromo_client on public.mevak_promociones(client_id, starts_at desc);

create table if not exists public.mevak_roadmaps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  titulo text not null, descripcion text, quarter text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mrm2_client on public.mevak_roadmaps(client_id);

create table if not exists public.mevak_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.mevak_roadmaps(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  titulo text not null, descripcion text,
  status public.mevak_roadmap_item_status not null default 'backlog',
  due_date date, order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mri_roadmap on public.mevak_roadmap_items(roadmap_id, order_index);
create index if not exists idx_mri_client on public.mevak_roadmap_items(client_id);

create table if not exists public.mevak_reuniones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  titulo text not null,
  scheduled_at timestamptz not null,
  duration_min int,
  status public.mevak_reunion_status not null default 'agendada',
  meeting_url text, notas text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mreu_client_sched on public.mevak_reuniones(client_id, scheduled_at desc);

create table if not exists public.mevak_tareas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  titulo text not null, descripcion text,
  status public.mevak_tarea_status not null default 'pendiente',
  priority public.mevak_tarea_priority not null default 'media',
  assigned_to uuid references auth.users(id),
  due_date date, completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mtar_client on public.mevak_tareas(client_id, status);
create index if not exists idx_mtar_assigned on public.mevak_tareas(assigned_to);

create table if not exists public.mevak_interacciones_whatsapp (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  direction public.mevak_wa_direction not null,
  from_number text, to_number text, message text, media_url text, wa_message_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_mwa_client_time on public.mevak_interacciones_whatsapp(client_id, occurred_at desc);

create table if not exists public.mevak_alertas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  severity public.mevak_alerta_severity not null default 'warning',
  status public.mevak_alerta_status not null default 'abierta',
  tipo text not null, titulo text not null, detalle text,
  payload jsonb not null default '{}'::jsonb,
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz, resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_mal_client_status on public.mevak_alertas(client_id, status, created_at desc);

create table if not exists public.mevak_documentos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  nombre text not null, tipo text,
  storage_path text not null,
  size_bytes bigint, mime_type text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_mdoc_client on public.mevak_documentos(client_id, created_at desc);

create table if not exists public.mevak_onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique, descripcion text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mevak_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.mevak_onboarding_templates(id) on delete cascade,
  titulo text not null, descripcion text,
  order_index int not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_moi_template on public.mevak_onboarding_items(template_id, order_index);

create table if not exists public.mevak_onboarding_status (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  item_id uuid not null references public.mevak_onboarding_items(id) on delete cascade,
  status public.mevak_onboarding_item_status not null default 'pendiente',
  notas text,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (client_id, item_id)
);
create index if not exists idx_mos_client on public.mevak_onboarding_status(client_id);

create table if not exists public.mevak_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  titulo text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_maic_user on public.mevak_ai_conversations(user_id, updated_at desc);

create table if not exists public.mevak_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.mevak_ai_conversations(id) on delete cascade,
  role public.mevak_ai_message_role not null,
  content text,
  tokens_in int, tokens_out int, model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_maim_conv on public.mevak_ai_messages(conversation_id, created_at);

create table if not exists public.mevak_ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.mevak_ai_messages(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb, error text, duration_ms int,
  created_at timestamptz not null default now()
);
create index if not exists idx_maitc_msg on public.mevak_ai_tool_calls(message_id);

create table if not exists public.mevak_ai_message_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.mevak_ai_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback public.mevak_ai_feedback not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.mevak_ai_tool_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  tool_name text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_maitcache_exp on public.mevak_ai_tool_cache(expires_at);

create table if not exists public.mevak_ai_config_history (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  previous_value jsonb,
  new_value jsonb not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create index if not exists idx_maich_key on public.mevak_ai_config_history(setting_key, changed_at desc);

create table if not exists public.mevak_app_settings (
  key text primary key,
  value jsonb not null,
  tipo text not null check (tipo in ('prompt', 'numeric', 'boolean', 'json', 'string')),
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- 5. Enable RLS
alter table public.mevak_reportes_semanales       enable row level security;
alter table public.mevak_reportes_mensuales       enable row level security;
alter table public.mevak_kpis_semanales           enable row level security;
alter table public.mevak_kpis_mensuales           enable row level security;
alter table public.mevak_promociones              enable row level security;
alter table public.mevak_roadmaps                 enable row level security;
alter table public.mevak_roadmap_items            enable row level security;
alter table public.mevak_reuniones                enable row level security;
alter table public.mevak_tareas                   enable row level security;
alter table public.mevak_interacciones_whatsapp   enable row level security;
alter table public.mevak_alertas                  enable row level security;
alter table public.mevak_documentos               enable row level security;
alter table public.mevak_onboarding_templates     enable row level security;
alter table public.mevak_onboarding_items         enable row level security;
alter table public.mevak_onboarding_status        enable row level security;
alter table public.mevak_ai_conversations         enable row level security;
alter table public.mevak_ai_messages              enable row level security;
alter table public.mevak_ai_tool_calls            enable row level security;
alter table public.mevak_ai_message_feedback      enable row level security;
alter table public.mevak_ai_tool_cache            enable row level security;
alter table public.mevak_ai_config_history        enable row level security;
alter table public.mevak_app_settings             enable row level security;

-- 6. Policies por client_id (loop)
do $$
declare t text;
  tables text[] := array[
    'mevak_reportes_semanales','mevak_reportes_mensuales','mevak_kpis_semanales','mevak_kpis_mensuales',
    'mevak_promociones','mevak_roadmaps','mevak_roadmap_items','mevak_reuniones','mevak_tareas',
    'mevak_interacciones_whatsapp','mevak_alertas','mevak_documentos','mevak_onboarding_status'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.mevak_can_access_client(auth.uid(), client_id))', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.mevak_can_write_client(auth.uid(), client_id)) with check (public.mevak_can_write_client(auth.uid(), client_id))', t || '_write', t);
  end loop;
end $$;

drop policy if exists "mot_read" on public.mevak_onboarding_templates;
create policy "mot_read" on public.mevak_onboarding_templates for select to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role) or public.has_mevak_role(auth.uid(), 'ejecutivo'::public.mevak_role));
drop policy if exists "mot_write" on public.mevak_onboarding_templates;
create policy "mot_write" on public.mevak_onboarding_templates for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))
  with check (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

drop policy if exists "moi_read" on public.mevak_onboarding_items;
create policy "moi_read" on public.mevak_onboarding_items for select to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role) or public.has_mevak_role(auth.uid(), 'ejecutivo'::public.mevak_role));
drop policy if exists "moi_write" on public.mevak_onboarding_items;
create policy "moi_write" on public.mevak_onboarding_items for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))
  with check (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

drop policy if exists "maic_owner" on public.mevak_ai_conversations;
create policy "maic_owner" on public.mevak_ai_conversations for all to authenticated
  using (user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))
  with check (user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

drop policy if exists "maim_via_conv" on public.mevak_ai_messages;
create policy "maim_via_conv" on public.mevak_ai_messages for all to authenticated
  using (exists (select 1 from public.mevak_ai_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))))
  with check (exists (select 1 from public.mevak_ai_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))));

drop policy if exists "maitc_via_msg" on public.mevak_ai_tool_calls;
create policy "maitc_via_msg" on public.mevak_ai_tool_calls for all to authenticated
  using (exists (select 1 from public.mevak_ai_messages m join public.mevak_ai_conversations c on c.id = m.conversation_id where m.id = message_id and (c.user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))))
  with check (exists (select 1 from public.mevak_ai_messages m join public.mevak_ai_conversations c on c.id = m.conversation_id where m.id = message_id and (c.user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))));

drop policy if exists "maimf_owner" on public.mevak_ai_message_feedback;
create policy "maimf_owner" on public.mevak_ai_message_feedback for all to authenticated
  using (user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))
  with check (user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

drop policy if exists "maitcache_none" on public.mevak_ai_tool_cache;
create policy "maitcache_none" on public.mevak_ai_tool_cache for select to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

drop policy if exists "maich_direccion" on public.mevak_ai_config_history;
create policy "maich_direccion" on public.mevak_ai_config_history for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))
  with check (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

drop policy if exists "mevak_app_settings_read_direccion" on public.mevak_app_settings;
create policy "mevak_app_settings_read_direccion" on public.mevak_app_settings for select to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));
drop policy if exists "mevak_app_settings_write_direccion" on public.mevak_app_settings;
create policy "mevak_app_settings_write_direccion" on public.mevak_app_settings for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role))
  with check (public.has_mevak_role(auth.uid(), 'direccion'::public.mevak_role));

-- 7. Triggers updated_at
do $$
declare t text;
  tables text[] := array[
    'mevak_reportes_semanales','mevak_reportes_mensuales','mevak_promociones','mevak_roadmaps',
    'mevak_roadmap_items','mevak_reuniones','mevak_tareas','mevak_onboarding_status','mevak_ai_conversations','mevak_app_settings'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.mevak_set_updated_at()', 'trg_' || t || '_updated_at', t);
  end loop;
end $$;

-- 8. Seed
insert into public.mevak_app_settings (key, value, tipo, description) values
  ('mevak.ai.copilot_system_prompt', '"[contenido inicial del system prompt — Lovable del CRM lo tiene en el código]"'::jsonb, 'prompt', 'System prompt del AI Copilot. Soporta variables: {user_role}, {user_language}, {user_scope_resumen}, {cliente_id}, {cliente_nombre}, {fecha_hoy}, {paises_accesibles}.'),
  ('mevak.ai.copilot_model_principal', '"claude-sonnet-4-6"'::jsonb, 'string', 'Modelo Claude para razonamiento y síntesis.'),
  ('mevak.ai.copilot_model_clasificacion', '"claude-haiku-4-5-20251001"'::jsonb, 'string', 'Modelo Claude para clasificación de intent (más barato).'),
  ('mevak.ai.copilot_temperature', '0.3'::jsonb, 'numeric', 'Temperatura del modelo (0-1, default 0.3 para respuestas más deterministas).'),
  ('mevak.ai.copilot_max_tokens', '2000'::jsonb, 'numeric', 'Tokens máximos por respuesta del Copilot.'),
  ('mevak.ai.copilot_limit_cliente_mensual', '50'::jsonb, 'numeric', 'Hard limit de preguntas mensuales por usuario cliente.'),
  ('mevak.ai.copilot_limit_ejecutivo_mensual', '200'::jsonb, 'numeric', 'Hard limit de preguntas mensuales por usuario ejecutivo.'),
  ('mevak.ai.copilot_limit_direccion_mensual', 'null'::jsonb, 'numeric', 'Hard limit dirección (null = sin límite).'),
  ('mevak.ai.copilot_tools_habilitadas', '["consultar_kpi","comparar_periodos","top_productos","comparar_clientes_o_sucursales"]'::jsonb, 'json', 'Lista de tools del Copilot habilitadas (Fase 1 = 4 básicas).'),
  ('mevak.ai.copilot_cache_ttl_segundos', '900'::jsonb, 'numeric', 'TTL del caché de tools en segundos.')
on conflict (key) do nothing;
