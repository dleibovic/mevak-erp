CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name text,
  period_month date NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  paid_by public.collector NOT NULL,
  paid_at date NOT NULL,
  note text,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_payments TO authenticated;
GRANT ALL ON public.salary_payments TO service_role;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_select_admin" ON public.salary_payments FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "sp_insert_admin" ON public.salary_payments FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "sp_update_admin" ON public.salary_payments FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "sp_delete_admin" ON public.salary_payments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.pay_salary(_employee_id uuid, _period_month date, _amount numeric, _currency text, _paid_by public.collector, _paid_at date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_cat uuid; v_country uuid; v_name text; v_exp uuid; v_id uuid; v_month date;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a 0'; END IF;
  IF _period_month IS NULL OR _paid_at IS NULL THEN RAISE EXCEPTION 'Mes y fecha de pago son obligatorios'; END IF;
  IF _currency IS NULL OR _paid_by IS NULL THEN RAISE EXCEPTION 'Moneda y quién pagó son obligatorios'; END IF;
  v_month := date_trunc('month', _period_month)::date;
  IF EXISTS (SELECT 1 FROM salary_payments WHERE employee_id = _employee_id AND period_month = v_month) THEN
    RAISE EXCEPTION 'Ese empleado ya tiene el sueldo registrado para ese mes';
  END IF;
  SELECT full_name, country_id INTO v_name, v_country FROM employees WHERE id = _employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empleado inexistente'; END IF;
  SELECT id INTO v_cat FROM expense_categories WHERE lower(name) = 'sueldos' LIMIT 1;
  INSERT INTO expenses (description, category_id, amount, currency, paid_by, date, period_month, country_id, recurring)
  VALUES ('Sueldo ' || v_name || ' ' || to_char(v_month, 'YYYY-MM'), v_cat, _amount, _currency, _paid_by, _paid_at, v_month, v_country, false)
  RETURNING id INTO v_exp;
  INSERT INTO salary_payments (employee_id, employee_name, period_month, amount, currency, paid_by, paid_at, note, expense_id, created_by)
  VALUES (_employee_id, v_name, v_month, _amount, _currency, _paid_by, _paid_at, NULLIF(trim(_note), ''), v_exp, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.undo_salary_payment(_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_exp uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT expense_id INTO v_exp FROM salary_payments WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago inexistente'; END IF;
  DELETE FROM salary_payments WHERE id = _payment_id;
  IF v_exp IS NOT NULL THEN DELETE FROM expenses WHERE id = v_exp; END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.pay_salary(uuid, date, numeric, text, public.collector, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.undo_salary_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_salary(uuid, date, numeric, text, public.collector, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_salary_payment(uuid) TO authenticated;