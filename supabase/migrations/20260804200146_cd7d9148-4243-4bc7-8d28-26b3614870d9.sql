BEGIN;

CREATE TABLE IF NOT EXISTS public.expense_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ARS',
  assigned_to public.expense_assignee NOT NULL DEFAULT 'company',
  country_id uuid REFERENCES public.countries(id),
  recurrence_frequency public.recurrence_frequency NOT NULL DEFAULT 'monthly',
  start_month date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_templates TO authenticated;
GRANT ALL ON public.expense_templates TO service_role;

ALTER TABLE public.expense_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage expense_templates" ON public.expense_templates;
CREATE POLICY "staff manage expense_templates" ON public.expense_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'administracion'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'administracion'));

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.expense_templates(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS period_month date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_template_period
  ON public.expenses (template_id, period_month) WHERE template_id IS NOT NULL;

DO $$
DECLARE r record; tid uuid;
BEGIN
  FOR r IN SELECT * FROM public.expenses WHERE recurring = true AND template_id IS NULL LOOP
    INSERT INTO public.expense_templates
      (description, category_id, amount, currency, assigned_to, country_id, recurrence_frequency, start_month, active)
    VALUES (r.description, r.category_id, r.amount, r.currency, r.assigned_to, r.country_id,
            COALESCE(r.recurrence_frequency,'monthly'), date_trunc('month', r.date)::date, true)
    RETURNING id INTO tid;
    UPDATE public.expenses
      SET recurring = false, recurrence_frequency = NULL, template_id = tid,
          period_month = date_trunc('month', r.date)::date
      WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.generate_recurring_expenses(_period date DEFAULT date_trunc('month', CURRENT_DATE)::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted integer := 0;
BEGIN
  INSERT INTO public.expenses
    (description, category_id, amount, currency, assigned_to, country_id, date, recurring, template_id, period_month)
  SELECT t.description, t.category_id, t.amount, t.currency, t.assigned_to, t.country_id,
         _period, false, t.id, _period
  FROM public.expense_templates t
  WHERE t.active = true
    AND t.start_month <= _period
    AND NOT EXISTS (
      SELECT 1 FROM public.expenses e WHERE e.template_id = t.id AND e.period_month = _period
    );
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_expenses(date) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.generate_recurring_expenses(date) TO authenticated;

COMMIT;