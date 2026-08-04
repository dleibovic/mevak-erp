drop policy if exists "invoices_read_staff" on storage.objects;
create policy "invoices_read_staff" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'administracion')));

drop policy if exists "invoices_insert_staff" on storage.objects;
create policy "invoices_insert_staff" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'invoices' and (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'administracion')));

drop policy if exists "invoices_delete_admin" on storage.objects;
create policy "invoices_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'invoices' and public.is_admin(auth.uid()));

create table if not exists public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.monthly_invoices(id) on delete cascade,
  kind text not null default 'generated' check (kind in ('generated','afip','other')),
  file_path text not null,
  file_name text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

grant select, insert, update, delete on public.invoice_documents to authenticated;
grant all on public.invoice_documents to service_role;

create index if not exists idx_invoice_documents_invoice on public.invoice_documents (invoice_id);

alter table public.invoice_documents enable row level security;

drop policy if exists "staff manage invoice_documents" on public.invoice_documents;
create policy "staff manage invoice_documents" on public.invoice_documents
  for all to authenticated
  using (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'administracion'))
  with check (public.is_admin(auth.uid()) or public.has_role(auth.uid(),'administracion'));