
-- 1. AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  field text,
  old_value text,
  new_value text,
  action text NOT NULL DEFAULT 'update',
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity, entity_id, changed_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage audit_log" ON public.audit_log FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "auth read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);

-- 2. MRR RECOMPUTE RUNS
CREATE TABLE public.mrr_recompute_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  months_total integer NOT NULL DEFAULT 0,
  months_processed integer NOT NULL DEFAULT 0,
  per_month_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  triggered_by uuid
);
CREATE UNIQUE INDEX one_running_recompute ON public.mrr_recompute_runs((status)) WHERE status = 'running';
ALTER TABLE public.mrr_recompute_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage mrr_recompute_runs" ON public.mrr_recompute_runs FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "auth read mrr_recompute_runs" ON public.mrr_recompute_runs FOR SELECT TO authenticated USING (true);

-- 3. EXCHANGE RATE OVERRIDES
CREATE TABLE public.exchange_rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,
  quote_currency text NOT NULL DEFAULT 'USD',
  period_month date NOT NULL,
  rate numeric NOT NULL,
  prefer_manual boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, period_month)
);
ALTER TABLE public.exchange_rate_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage exchange_rate_overrides" ON public.exchange_rate_overrides FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "auth read exchange_rate_overrides" ON public.exchange_rate_overrides FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_exchange_overrides_updated_at BEFORE UPDATE ON public.exchange_rate_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- 4. needs_recompute column
ALTER TABLE public.mrr_snapshots ADD COLUMN needs_recompute boolean NOT NULL DEFAULT false;

-- 5. trigger: invalidar snapshots cuando cambia un override
CREATE OR REPLACE FUNCTION public.exchange_override_invalidate_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m date := date_trunc('month', COALESCE(NEW.period_month, OLD.period_month))::date;
BEGIN
  UPDATE public.mrr_snapshots SET needs_recompute = true WHERE snapshot_month = m;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_exchange_override_invalidate
AFTER INSERT OR UPDATE OR DELETE ON public.exchange_rate_overrides
FOR EACH ROW EXECUTE FUNCTION public.exchange_override_invalidate_snapshot();

-- 6. get_exchange_rate prioriza override manual
CREATE OR REPLACE FUNCTION public.get_exchange_rate(_currency text, _period_month date)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT rate FROM public.exchange_rate_overrides
      WHERE base_currency = _currency AND quote_currency = 'USD'
        AND period_month = date_trunc('month', _period_month)::date
        AND prefer_manual = true LIMIT 1),
    (SELECT rate FROM public.exchange_rates
      WHERE base_currency = _currency AND quote_currency = 'USD'
        AND rate_date <= (date_trunc('month', _period_month) + INTERVAL '1 month - 1 day')::date
      ORDER BY rate_date DESC LIMIT 1),
    (SELECT rate FROM public.exchange_rates
      WHERE base_currency = _currency AND quote_currency = 'USD'
      ORDER BY rate_date DESC LIMIT 1),
    CASE WHEN _currency = 'USD' THEN 1 ELSE NULL END
  );
$$;

-- 7. validación + audit de activated_at en clients
CREATE OR REPLACE FUNCTION public.clients_validate_activated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acting uuid;
BEGIN
  IF NEW.activated_at IS NOT NULL THEN
    IF NEW.activated_at > CURRENT_DATE THEN
      RAISE EXCEPTION 'activated_at no puede ser posterior a hoy';
    END IF;
    IF NEW.paused_at IS NOT NULL AND NEW.activated_at > NEW.paused_at THEN
      RAISE EXCEPTION 'activated_at no puede ser posterior a paused_at';
    END IF;
    IF NEW.churned_at IS NOT NULL AND NEW.activated_at > NEW.churned_at THEN
      RAISE EXCEPTION 'activated_at no puede ser posterior a churned_at';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.activated_at IS DISTINCT FROM OLD.activated_at THEN
    BEGIN acting := COALESCE(NULLIF(current_setting('app.acting_user', true), '')::uuid, auth.uid());
    EXCEPTION WHEN others THEN acting := auth.uid(); END;
    INSERT INTO public.audit_log(entity, entity_id, field, old_value, new_value, action, changed_by)
    VALUES ('clients', NEW.id, 'activated_at', OLD.activated_at::text, NEW.activated_at::text, 'update', acting);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_clients_validate_activated_at
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_validate_activated_at();

-- Reattach existing lifecycle/price/churn triggers if not present (defensive: only create if missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clients_status_lifecycle') THEN
    CREATE TRIGGER trg_clients_status_lifecycle BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.clients_status_lifecycle();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clients_log_price_history') THEN
    CREATE TRIGGER trg_clients_log_price_history AFTER UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.clients_log_price_history();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clients_emit_churn_event') THEN
    CREATE TRIGGER trg_clients_emit_churn_event AFTER UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.clients_emit_churn_event();
  END IF;
END $$;

-- 8. start_mrr_recompute: orquesta recompute con tracking, solo admin
CREATE OR REPLACE FUNCTION public.start_mrr_recompute(_months integer DEFAULT 24)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acting uuid := auth.uid();
  run_id uuid;
  i int;
  m date;
  r_start timestamptz;
  r_done timestamptz;
  results jsonb := '[]'::jsonb;
  oldest date;
BEGIN
  IF NOT public.is_admin(acting) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.mrr_recompute_runs(triggered_by, months_total, status)
  VALUES (acting, _months, 'running')
  RETURNING id INTO run_id;

  BEGIN
    FOR i IN REVERSE (_months - 1)..0 LOOP
      m := (date_trunc('month', CURRENT_DATE) - (i || ' months')::interval)::date;
      r_start := clock_timestamp();
      PERFORM public.recompute_mrr_for_month(m);
      r_done := clock_timestamp();
      results := results || jsonb_build_array(jsonb_build_object(
        'month', m,
        'duration_ms', round(extract(epoch from (r_done - r_start)) * 1000)
      ));
      UPDATE public.mrr_recompute_runs
        SET months_processed = _months - i, per_month_results = results
        WHERE id = run_id;
    END LOOP;

    oldest := (date_trunc('month', CURRENT_DATE) - ((_months - 1) || ' months')::interval)::date;
    UPDATE public.mrr_snapshots SET needs_recompute = false WHERE snapshot_month >= oldest;

    UPDATE public.mrr_recompute_runs SET status = 'success', finished_at = now() WHERE id = run_id;
  EXCEPTION WHEN others THEN
    UPDATE public.mrr_recompute_runs SET status = 'error', error = SQLERRM, finished_at = now() WHERE id = run_id;
    RAISE;
  END;

  RETURN run_id;
END $$;

-- 9. Upsert helper para overrides (preserva autor)
CREATE OR REPLACE FUNCTION public.upsert_exchange_rate_override(
  _currency text, _month date, _rate numeric, _prefer_manual boolean DEFAULT true, _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acting uuid := auth.uid();
  m date := date_trunc('month', _month)::date;
  rid uuid;
BEGIN
  IF NOT public.is_admin(acting) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.exchange_rate_overrides(base_currency, quote_currency, period_month, rate, prefer_manual, notes, created_by, updated_by)
  VALUES (_currency, 'USD', m, _rate, _prefer_manual, _notes, acting, acting)
  ON CONFLICT (base_currency, quote_currency, period_month) DO UPDATE
    SET rate = EXCLUDED.rate, prefer_manual = EXCLUDED.prefer_manual, notes = EXCLUDED.notes,
        updated_by = acting, updated_at = now()
  RETURNING id INTO rid;
  RETURN rid;
END $$;
