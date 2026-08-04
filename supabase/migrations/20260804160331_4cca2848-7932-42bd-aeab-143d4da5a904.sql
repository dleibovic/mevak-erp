CREATE TABLE IF NOT EXISTS public.commission_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  commission_value numeric(14,2) NOT NULL DEFAULT 0,
  commission_currency text NOT NULL,
  billed_amount numeric(14,2),
  billed_currency text,
  was_billed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_snapshots_period ON public.commission_snapshots (period_month);
CREATE INDEX IF NOT EXISTS idx_commission_snapshots_employee ON public.commission_snapshots (employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_snapshots TO authenticated;
GRANT ALL ON public.commission_snapshots TO service_role;

ALTER TABLE public.commission_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage commission_snapshots" ON public.commission_snapshots
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admon read commission_snapshots" ON public.commission_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'administracion'));

CREATE OR REPLACE FUNCTION public.snapshot_commissions_for_month(_period date DEFAULT date_trunc('month', CURRENT_DATE)::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.commission_snapshots WHERE period_month = _period;
  INSERT INTO public.commission_snapshots
    (period_month, employee_id, employee_name, client_id, client_name,
     commission_value, commission_currency, billed_amount, billed_currency, was_billed)
  SELECT _period, e.id, e.full_name, c.id, c.company_name,
         cec.commission_value, cec.currency,
         mi.amount, mi.currency, (mi.id IS NOT NULL)
  FROM public.client_executive_commission cec
  JOIN public.employees e ON e.id = cec.employee_id
  JOIN public.clients   c ON c.id = cec.client_id
  LEFT JOIN public.monthly_invoices mi ON mi.client_id = c.id AND mi.period_month = _period;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.snapshot_commissions_for_month(date) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.snapshot_commissions_for_month(date) TO authenticated;

DO $$
DECLARE m date;
BEGIN
  FOR m IN SELECT (date_trunc('month', CURRENT_DATE)::date - (k||' months')::interval)::date
           FROM generate_series(0,11) AS k
  LOOP PERFORM public.snapshot_commissions_for_month(m); END LOOP;
END $$;