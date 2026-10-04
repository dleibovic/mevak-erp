CREATE TABLE public.partner_debts (
  id uuid primary key default gen_random_uuid(),
  ledger text not null check (ledger in ('meri','empresa')),
  currency text not null default 'USD',
  amount_usd numeric not null,
  entry_type text not null check (entry_type in ('opening','freeze','incobrable_split','payment','adjustment')),
  concept text,
  origin_period date,
  origin_rate_ars numeric,
  amount_ars_origin numeric,
  related_invoice_id uuid references public.monthly_invoices(id),
  entry_date date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_debts TO authenticated;
GRANT ALL ON public.partner_debts TO service_role;

ALTER TABLE public.partner_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read partner_debts" ON public.partner_debts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert partner_debts" ON public.partner_debts FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update partner_debts" ON public.partner_debts FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete partner_debts" ON public.partner_debts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));