
-- 1) Invert existing API rates to canonical format (local per USD)
UPDATE public.exchange_rates
   SET rate = 1 / rate,
       notes = COALESCE(notes,'') || ' [inverted to canonical local-per-USD]'
 WHERE base_currency <> 'USD' AND rate > 0 AND rate < 1;
-- Note: existing overrides (1400, 1430) already in canonical format; not touched.

-- 2) Validation ranges table
CREATE TABLE public.exchange_rate_validation_ranges (
  currency text PRIMARY KEY,
  min_rate numeric NOT NULL,
  max_rate numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_rate_validation_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ranges" ON public.exchange_rate_validation_ranges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ranges" ON public.exchange_rate_validation_ranges FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.exchange_rate_validation_ranges(currency, min_rate, max_rate) VALUES
  ('ARS', 100, 100000),
  ('BRL', 1, 100),
  ('MXN', 5, 500),
  ('EUR', 0.5, 5),
  ('GBP', 0.3, 5),
  ('USD', 1, 1)
ON CONFLICT (currency) DO NOTHING;

-- 3) Rewrite get_exchange_rate to return canonical "local per USD" rate (same value, new semantic)
-- (Signature unchanged; callers must DIVIDE by it.)
CREATE OR REPLACE FUNCTION public.get_exchange_rate(_currency text, _period_month date)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
$function$;

-- 4) Helper: convert local amount -> USD using canonical rate
CREATE OR REPLACE FUNCTION public.to_usd(_amount numeric, _currency text, _period_month date)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _amount IS NULL THEN NULL
    WHEN _currency = 'USD' THEN ROUND(_amount, 2)
    ELSE (
      SELECT CASE WHEN r IS NULL OR r = 0 THEN NULL ELSE ROUND(_amount / r, 2) END
      FROM (SELECT public.get_exchange_rate(_currency, _period_month) AS r) x
    )
  END;
$function$;

-- 5) recompute_mrr_for_month: divide instead of multiply
CREATE OR REPLACE FUNCTION public.recompute_mrr_for_month(_period date)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  m_start date := date_trunc('month', _period)::date;
  m_end   date := (date_trunc('month', _period) + INTERVAL '1 month - 1 day')::date;
  prev_start date := (date_trunc('month', _period) - INTERVAL '1 month')::date;
  has_real_history boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.client_price_history WHERE effective_date < m_start) INTO has_real_history;

  DELETE FROM public.client_mrr_history WHERE snapshot_month = m_start;
  DELETE FROM public.mrr_snapshots WHERE snapshot_month = m_start;

  WITH client_snap AS (
    SELECT
      c.id AS client_id,
      c.fee_currency AS currency,
      c.activated_at,
      c.churned_at,
      mi.amount AS invoice_amount,
      public.prorated_mrr(
        COALESCE(mi.amount, public.effective_monthly_fee(c.id)),
        m_start, c.activated_at,
        CASE WHEN c.churned_at IS NOT NULL AND c.churned_at <= m_end THEN c.churned_at ELSE NULL END
      ) AS mrr_amount,
      (mi.amount IS NULL) AS estimated
    FROM public.clients c
    LEFT JOIN public.monthly_invoices mi
      ON mi.client_id = c.id AND mi.period_month = m_start
    WHERE c.activated_at IS NOT NULL AND c.activated_at <= m_end
      AND (c.churned_at IS NULL OR c.churned_at >= m_start)
  ),
  prev AS (
    SELECT client_id, mrr_amount AS prev_mrr, currency AS prev_currency
      FROM public.client_mrr_history WHERE snapshot_month = prev_start
  )
  INSERT INTO public.client_mrr_history
    (client_id, snapshot_month, currency, mrr_amount, mrr_amount_usd, movement_type, previous_mrr, delta, is_estimated)
  SELECT
    cs.client_id, m_start, cs.currency, cs.mrr_amount,
    public.to_usd(cs.mrr_amount, cs.currency, m_start),
    CASE
      WHEN p.client_id IS NULL AND cs.mrr_amount > 0 THEN 'new'::mrr_movement_type
      WHEN p.client_id IS NOT NULL AND p.prev_currency <> cs.currency THEN 'currency_switch'::mrr_movement_type
      WHEN COALESCE(p.prev_mrr,0) = 0 AND cs.mrr_amount > 0 THEN 'reactivation'::mrr_movement_type
      WHEN cs.mrr_amount > COALESCE(p.prev_mrr,0) THEN 'expansion'::mrr_movement_type
      WHEN cs.mrr_amount < COALESCE(p.prev_mrr,0) THEN 'contraction'::mrr_movement_type
      ELSE 'new'::mrr_movement_type
    END,
    p.prev_mrr,
    cs.mrr_amount - COALESCE(p.prev_mrr, 0),
    cs.estimated OR NOT has_real_history
  FROM client_snap cs
  LEFT JOIN prev p ON p.client_id = cs.client_id;

  INSERT INTO public.client_mrr_history
    (client_id, snapshot_month, currency, mrr_amount, mrr_amount_usd, movement_type, previous_mrr, delta, is_estimated, notes)
  SELECT
    cmh.client_id, m_start, p.prev_currency, 0, 0,
    'currency_switch'::mrr_movement_type, p.prev_mrr, -p.prev_mrr,
    cmh.is_estimated, 'currency switch contraction leg'
  FROM public.client_mrr_history cmh
  JOIN (
    SELECT client_id, mrr_amount AS prev_mrr, currency AS prev_currency
      FROM public.client_mrr_history WHERE snapshot_month = prev_start
  ) p ON p.client_id = cmh.client_id
  WHERE cmh.snapshot_month = m_start
    AND cmh.movement_type = 'currency_switch'
    AND p.prev_currency <> cmh.currency;

  INSERT INTO public.client_mrr_history
    (client_id, snapshot_month, currency, mrr_amount, mrr_amount_usd, movement_type, previous_mrr, delta, is_estimated)
  SELECT
    c.id, m_start, c.fee_currency, 0, 0, 'churn'::mrr_movement_type,
    p.prev_mrr, -COALESCE(p.prev_mrr, 0),
    NOT has_real_history
  FROM public.clients c
  LEFT JOIN (
    SELECT client_id, mrr_amount AS prev_mrr FROM public.client_mrr_history WHERE snapshot_month = prev_start
  ) p ON p.client_id = c.id
  WHERE c.churned_at IS NOT NULL AND c.churned_at BETWEEN m_start AND m_end;

  INSERT INTO public.mrr_snapshots
    (snapshot_month, currency, is_consolidated, mrr_amount, active_clients_count,
     new_mrr, expansion_mrr, contraction_mrr, churn_mrr, reactivation_mrr, is_estimated)
  SELECT
    m_start, cmh.currency, false,
    COALESCE(SUM(CASE WHEN cmh.movement_type <> 'churn' THEN cmh.mrr_amount ELSE 0 END), 0),
    COUNT(DISTINCT CASE WHEN cmh.mrr_amount > 0 THEN cmh.client_id END),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'new' THEN cmh.mrr_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'expansion' THEN cmh.delta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'contraction' THEN -cmh.delta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'churn' THEN -cmh.delta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'reactivation' THEN cmh.mrr_amount ELSE 0 END), 0),
    COALESCE(bool_or(cmh.is_estimated), NOT has_real_history)
  FROM public.client_mrr_history cmh
  WHERE cmh.snapshot_month = m_start
  GROUP BY cmh.currency;

  INSERT INTO public.mrr_snapshots
    (snapshot_month, currency, is_consolidated, mrr_amount, active_clients_count,
     new_mrr, expansion_mrr, contraction_mrr, churn_mrr, reactivation_mrr, is_estimated)
  SELECT
    m_start, 'USD', true,
    COALESCE(SUM(CASE WHEN cmh.movement_type <> 'churn' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COUNT(DISTINCT CASE WHEN cmh.mrr_amount > 0 THEN cmh.client_id END),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'new' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'expansion' AND cmh.delta > 0
                      THEN public.to_usd(cmh.delta, cmh.currency, m_start) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'contraction'
                      THEN public.to_usd(-cmh.delta, cmh.currency, m_start) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'churn'
                      THEN public.to_usd(-cmh.delta, cmh.currency, m_start) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'reactivation' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COALESCE(bool_or(cmh.is_estimated), NOT has_real_history)
  FROM public.client_mrr_history cmh
  WHERE cmh.snapshot_month = m_start;
END $function$;

-- 6) auto_churn_paused_clients: use to_usd
CREATE OR REPLACE FUNCTION public.auto_churn_paused_clients()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  threshold integer;
  affected integer := 0;
BEGIN
  SELECT paused_to_churned_days INTO threshold FROM public.app_settings WHERE id = 1;
  WITH upd AS (
    UPDATE public.clients
       SET status = 'churned', churned_at = CURRENT_DATE
     WHERE status = 'paused'
       AND paused_at IS NOT NULL
       AND paused_at < CURRENT_DATE - threshold
    RETURNING id, fee_currency
  ),
  ev AS (
    INSERT INTO public.churn_events (client_id, churned_at, reason_code, reason_detail, mrr_lost, currency, mrr_lost_usd)
    SELECT u.id, CURRENT_DATE, 'paused_timeout', 'auto: paused > ' || threshold || ' days',
           public.effective_monthly_fee(u.id), u.fee_currency,
           public.to_usd(public.effective_monthly_fee(u.id), u.fee_currency, CURRENT_DATE)
      FROM upd u
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM ev;
  RETURN affected;
END $function$;

-- 7) clients_emit_churn_event: use to_usd
CREATE OR REPLACE FUNCTION public.clients_emit_churn_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  acting uuid;
  fee numeric;
BEGIN
  IF NEW.status = 'churned' AND OLD.status IS DISTINCT FROM 'churned' THEN
    BEGIN acting := COALESCE(NULLIF(current_setting('app.acting_user', true), '')::uuid, auth.uid());
    EXCEPTION WHEN others THEN acting := auth.uid(); END;

    fee := public.effective_monthly_fee(NEW.id);

    INSERT INTO public.churn_events (client_id, churned_at, reason_code, mrr_lost, currency, mrr_lost_usd, created_by)
    VALUES (NEW.id, COALESCE(NEW.churned_at, CURRENT_DATE), 'manual', fee, NEW.fee_currency,
            public.to_usd(fee, NEW.fee_currency, CURRENT_DATE),
            acting);
  END IF;
  RETURN NEW;
END $function$;
