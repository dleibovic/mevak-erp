-- Mevak CRM: roles independientes del ERP
do $$ begin
  create type public.mevak_role as enum ('direccion', 'ejecutivo', 'cliente');
exception when duplicate_object then null; end $$;

create table if not exists public.mevak_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.mevak_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.mevak_user_roles enable row level security;

create or replace function public.has_mevak_role(_user_id uuid, _role public.mevak_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mevak_user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.get_mevak_role(_user_id uuid)
returns public.mevak_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.mevak_user_roles
  where user_id = _user_id
  order by case role
    when 'direccion' then 1
    when 'ejecutivo' then 2
    when 'cliente' then 3
  end
  limit 1;
$$;

drop policy if exists "mevak_roles_self_read" on public.mevak_user_roles;
create policy "mevak_roles_self_read" on public.mevak_user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_mevak_role(auth.uid(), 'direccion'));

drop policy if exists "mevak_roles_direccion_write" on public.mevak_user_roles;
create policy "mevak_roles_direccion_write" on public.mevak_user_roles
  for all to authenticated
  using (public.has_mevak_role(auth.uid(), 'direccion'))
  with check (public.has_mevak_role(auth.uid(), 'direccion'));