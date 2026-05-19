
-- =========================================================
-- MRR / Churn / LTV infrastructure
-- =========================================================

-- 1. Recreate client_status enum with the 4 desired values
ALTER TYPE public.client_status RENAME TO client_status__old;
CREATE TYPE public.client_status AS ENUM ('onboarding', 'active', 'paused', 'churned');

ALTER TABLE public.clients
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.client_status USING (
    CASE status::text
      WHEN 'active' THEN 'active'
      WHEN 'inactive' THEN 'churned'
      WHEN 'suspended' THEN 'paused'
      WHEN 'pending_setup' THEN 'onboarding'
      ELSE 'active'
    END
  )::public.client_status,
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.client_sub_brands
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.client_status USING (
    CASE status::text
      WHEN 'active' THEN 'active'
      WHEN 'inactive' THEN 'churned'
      WHEN 'suspended' THEN 'paused'
      WHEN 'pending_setup' THEN 'onboarding'
      ELSE 'active'
    END
  )::public.client_status,
  ALTER COLUMN status SET DEFAULT 'active';

DROP TYPE public.client_status__old;

-- 2. clients.activated_at + churned_at
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS activated_at date,
  ADD COLUMN IF NOT EXISTS churned_at date,
  ADD COLUMN IF NOT EXISTS paused_at date;

-- Backfill existing active clients: their activation date = created_at
UPDATE public.clients
   SET activated_at = created_at::date
 WHERE status = 'active' AND activated_at IS NULL;

-- 3. New enums
CREATE TYPE public.mrr_movement_type AS ENUM (
  'new', 'expansion', 'contraction', 'churn', 'reactivation', 'currency_switch'
);
CREATE TYPE public.exchange_rate_source AS ENUM ('api', 'manual');
CREATE TYPE public.churn_reason_code AS ENUM (
  'manual', 'paused_timeout', 'non_payment', 'dissatisfied', 'price', 'competitor', 'closed_business', 'other'
);

-- 4. app_settings (configurable knobs)
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  paused_to_churned_days integer NOT NULL DEFAULT 60,
  mrr_base_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage app_settings" ON public.app_settings FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE TRIGGER set_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- 5. exchange_rates
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,            -- e.g. ARS, EUR
  quote_currency text NOT NULL DEFAULT 'USD',
  rate_date date NOT NULL,                -- last day of the month it represents
  rate numeric(18,8) NOT NULL CHECK (rate > 0),
  source public.exchange_rate_source NOT NULL DEFAULT 'api',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, rate_date)
);
CREATE INDEX idx_exchange_rates_lookup ON public.exchange_rates (base_currency, quote_currency, rate_date DESC);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read exchange_rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage exchange_rates" ON public.exchange_rates FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE TRIGGER set_exchange_rates_updated_at BEFORE UPDATE ON public.exchange_rates FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- Seed identity rate USD->USD
INSERT INTO public.exchange_rates (base_currency, quote_currency, rate_date, rate, source, notes)
SELECT 'USD','USD', date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 day', 1, 'manual', 'identity seed'
ON CONFLICT DO NOTHING;

-- Helper: get rate for currency at month (uses latest <= last day of month, falls back to most recent)
CREATE OR REPLACE FUNCTION public.get_exchange_rate(_currency text, _period_month date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
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

-- 6. mrr_snapshots (one row per month per currency, plus a 'USD' consolidated row)
CREATE TABLE public.mrr_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_month date NOT NULL,            -- first day of month
  currency text NOT NULL,                  -- 'ARS','EUR','USD' (USD = consolidated converted)
  is_consolidated boolean NOT NULL DEFAULT false,
  mrr_amount numeric(18,2) NOT NULL DEFAULT 0,
  active_clients_count integer NOT NULL DEFAULT 0,
  new_mrr numeric(18,2) NOT NULL DEFAULT 0,
  expansion_mrr numeric(18,2) NOT NULL DEFAULT 0,
  contraction_mrr numeric(18,2) NOT NULL DEFAULT 0,
  churn_mrr numeric(18,2) NOT NULL DEFAULT 0,
  reactivation_mrr numeric(18,2) NOT NULL DEFAULT 0,
  net_new_mrr numeric(18,2) GENERATED ALWAYS AS (new_mrr + expansion_mrr + reactivation_mrr - contraction_mrr - churn_mrr) STORED,
  is_estimated boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_month, currency, is_consolidated)
);
CREATE INDEX idx_mrr_snapshots_month ON public.mrr_snapshots (snapshot_month DESC, currency);
ALTER TABLE public.mrr_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage mrr_snapshots" ON public.mrr_snapshots FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "auth read mrr_snapshots" ON public.mrr_snapshots FOR SELECT TO authenticated USING (true);

-- 7. client_mrr_history
CREATE TABLE public.client_mrr_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  snapshot_month date NOT NULL,
  currency text NOT NULL,
  mrr_amount numeric(18,2) NOT NULL DEFAULT 0,        -- prorated MRR for that month in client currency
  mrr_amount_usd numeric(18,2),
  movement_type public.mrr_movement_type NOT NULL,
  previous_mrr numeric(18,2),
  delta numeric(18,2),
  is_estimated boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmh_client_month ON public.client_mrr_history (client_id, snapshot_month);
CREATE INDEX idx_cmh_month ON public.client_mrr_history (snapshot_month, movement_type);
ALTER TABLE public.client_mrr_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage cmh" ON public.client_mrr_history FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "exec read own cmh" ON public.client_mrr_history FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT c.id FROM clients c
     WHERE c.assigned_executive_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid())
        OR c.billing_user_id = auth.uid()
  ));

-- 8. churn_events
CREATE TABLE public.churn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  churned_at date NOT NULL DEFAULT CURRENT_DATE,
  reason_code public.churn_reason_code NOT NULL DEFAULT 'manual',
  reason_detail text,
  mrr_lost numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL,
  mrr_lost_usd numeric(18,2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_churn_events_client ON public.churn_events (client_id);
CREATE INDEX idx_churn_events_date ON public.churn_events (churned_at DESC);
ALTER TABLE public.churn_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage churn_events" ON public.churn_events FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "exec read own churn_events" ON public.churn_events FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT c.id FROM clients c
     WHERE c.assigned_executive_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid())
  ));

-- 9. Pro-rata helper
CREATE OR REPLACE FUNCTION public.prorated_mrr(
  _fee numeric, _period_month date, _activated_at date, _churned_at date
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  WITH bounds AS (
    SELECT date_trunc('month', _period_month)::date AS m_start,
           (date_trunc('month', _period_month) + INTERVAL '1 month - 1 day')::date AS m_end
  ),
  span AS (
    SELECT
      GREATEST(b.m_start, COALESCE(_activated_at, b.m_start)) AS s,
      LEAST(b.m_end, COALESCE(_churned_at, b.m_end)) AS e,
      (b.m_end - b.m_start + 1) AS dim
    FROM bounds b
  )
  SELECT CASE
    WHEN s > e THEN 0
    ELSE ROUND(_fee * ((e - s + 1)::numeric / dim::numeric), 2)
  END FROM span;
$$;

-- 10. Trigger: clients status transitions
CREATE OR REPLACE FUNCTION public.clients_status_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acting uuid;
BEGIN
  BEGIN acting := COALESCE(NULLIF(current_setting('app.acting_user', true), '')::uuid, auth.uid());
  EXCEPTION WHEN others THEN acting := auth.uid(); END;

  -- First time becoming active -> set activated_at
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') AND NEW.activated_at IS NULL THEN
    NEW.activated_at := CURRENT_DATE;
  END IF;

  -- Transition into paused
  IF NEW.status = 'paused' AND OLD.status IS DISTINCT FROM 'paused' THEN
    NEW.paused_at := CURRENT_DATE;
  END IF;

  -- Clear paused_at when leaving paused
  IF NEW.status <> 'paused' AND OLD.status = 'paused' THEN
    NEW.paused_at := NULL;
  END IF;

  -- Transition into churned
  IF NEW.status = 'churned' AND OLD.status IS DISTINCT FROM 'churned' THEN
    IF NEW.churned_at IS NULL THEN NEW.churned_at := CURRENT_DATE; END IF;
  END IF;

  -- Reactivation: clear churned_at
  IF NEW.status = 'active' AND OLD.status = 'churned' THEN
    NEW.churned_at := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clients_status_lifecycle_trg ON public.clients;
CREATE TRIGGER clients_status_lifecycle_trg
BEFORE UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_status_lifecycle();

-- AFTER trigger: emit churn_event when transitioning to churned
CREATE OR REPLACE FUNCTION public.clients_emit_churn_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acting uuid;
  rate numeric;
  fee numeric;
BEGIN
  IF NEW.status = 'churned' AND OLD.status IS DISTINCT FROM 'churned' THEN
    BEGIN acting := COALESCE(NULLIF(current_setting('app.acting_user', true), '')::uuid, auth.uid());
    EXCEPTION WHEN others THEN acting := auth.uid(); END;

    fee := public.effective_monthly_fee(NEW.id);
    rate := public.get_exchange_rate(NEW.fee_currency, CURRENT_DATE);

    INSERT INTO public.churn_events (client_id, churned_at, reason_code, mrr_lost, currency, mrr_lost_usd, created_by)
    VALUES (NEW.id, COALESCE(NEW.churned_at, CURRENT_DATE), 'manual', fee, NEW.fee_currency,
            CASE WHEN rate IS NOT NULL THEN ROUND(fee * rate, 2) ELSE NULL END,
            acting);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clients_emit_churn_event_trg ON public.clients;
CREATE TRIGGER clients_emit_churn_event_trg
AFTER UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_emit_churn_event();

-- 11. recompute_mrr_for_month (idempotent)
CREATE OR REPLACE FUNCTION public.recompute_mrr_for_month(_period date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m_start date := date_trunc('month', _period)::date;
  m_end   date := (date_trunc('month', _period) + INTERVAL '1 month - 1 day')::date;
  prev_start date := (date_trunc('month', _period) - INTERVAL '1 month')::date;
  has_real_history boolean;
BEGIN
  -- Decide if the month falls inside the era with real client_price_history
  SELECT EXISTS (
    SELECT 1 FROM public.client_price_history
     WHERE effective_date < m_start
  ) INTO has_real_history;

  -- Wipe existing rows for the month (idempotent)
  DELETE FROM public.client_mrr_history WHERE snapshot_month = m_start;
  DELETE FROM public.mrr_snapshots WHERE snapshot_month = m_start;

  -- Per-client snapshot: amount sourced from monthly_invoices if available, else from current fee (estimated)
  WITH client_snap AS (
    SELECT
      c.id AS client_id,
      c.fee_currency AS currency,
      c.activated_at,
      c.churned_at,
      mi.amount AS invoice_amount,
      public.effective_monthly_fee(c.id) AS current_fee,
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
      FROM public.client_mrr_history
     WHERE snapshot_month = prev_start
  )
  INSERT INTO public.client_mrr_history
    (client_id, snapshot_month, currency, mrr_amount, mrr_amount_usd, movement_type, previous_mrr, delta, is_estimated)
  SELECT
    cs.client_id, m_start, cs.currency, cs.mrr_amount,
    CASE WHEN public.get_exchange_rate(cs.currency, m_start) IS NOT NULL
         THEN ROUND(cs.mrr_amount * public.get_exchange_rate(cs.currency, m_start), 2)
         ELSE NULL END,
    CASE
      WHEN p.client_id IS NULL AND cs.mrr_amount > 0 THEN 'new'::mrr_movement_type
      WHEN p.client_id IS NOT NULL AND p.prev_currency <> cs.currency THEN 'currency_switch'::mrr_movement_type
      WHEN p.prev_mrr = 0 AND cs.mrr_amount > 0 THEN 'reactivation'::mrr_movement_type
      WHEN cs.mrr_amount > p.prev_mrr THEN 'expansion'::mrr_movement_type
      WHEN cs.mrr_amount < p.prev_mrr THEN 'contraction'::mrr_movement_type
      ELSE 'new'::mrr_movement_type
    END,
    p.prev_mrr,
    cs.mrr_amount - COALESCE(p.prev_mrr, 0),
    cs.estimated OR NOT has_real_history
  FROM client_snap cs
  LEFT JOIN prev p ON p.client_id = cs.client_id;

  -- Currency switch: also insert the contraction in old currency
  INSERT INTO public.client_mrr_history
    (client_id, snapshot_month, currency, mrr_amount, mrr_amount_usd, movement_type, previous_mrr, delta, is_estimated, notes)
  SELECT
    cmh.client_id, m_start, p.prev_currency, 0,
    0,
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

  -- Churn rows: clients churned this month
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
  WHERE c.churned_at IS NOT NULL
    AND c.churned_at BETWEEN m_start AND m_end;

  -- Per-currency snapshot
  INSERT INTO public.mrr_snapshots
    (snapshot_month, currency, is_consolidated, mrr_amount, active_clients_count,
     new_mrr, expansion_mrr, contraction_mrr, churn_mrr, reactivation_mrr, is_estimated)
  SELECT
    m_start, cmh.currency, false,
    SUM(CASE WHEN cmh.movement_type <> 'churn' THEN cmh.mrr_amount ELSE 0 END),
    COUNT(DISTINCT CASE WHEN cmh.mrr_amount > 0 THEN cmh.client_id END),
    SUM(CASE WHEN cmh.movement_type = 'new' THEN cmh.mrr_amount ELSE 0 END),
    SUM(CASE WHEN cmh.movement_type = 'expansion' THEN cmh.delta ELSE 0 END),
    SUM(CASE WHEN cmh.movement_type = 'contraction' THEN -cmh.delta ELSE 0 END),
    SUM(CASE WHEN cmh.movement_type = 'churn' THEN -cmh.delta ELSE 0 END),
    SUM(CASE WHEN cmh.movement_type = 'reactivation' THEN cmh.mrr_amount ELSE 0 END),
    bool_or(cmh.is_estimated)
  FROM public.client_mrr_history cmh
  WHERE cmh.snapshot_month = m_start
  GROUP BY cmh.currency;

  -- Consolidated USD snapshot
  INSERT INTO public.mrr_snapshots
    (snapshot_month, currency, is_consolidated, mrr_amount, active_clients_count,
     new_mrr, expansion_mrr, contraction_mrr, churn_mrr, reactivation_mrr, is_estimated)
  SELECT
    m_start, 'USD', true,
    COALESCE(SUM(CASE WHEN cmh.movement_type <> 'churn' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COUNT(DISTINCT CASE WHEN cmh.mrr_amount > 0 THEN cmh.client_id END),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'new' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'expansion' AND cmh.delta > 0
                      THEN ROUND(cmh.delta * public.get_exchange_rate(cmh.currency, m_start), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'contraction'
                      THEN ROUND(-cmh.delta * public.get_exchange_rate(cmh.currency, m_start), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'churn'
                      THEN ROUND(-cmh.delta * public.get_exchange_rate(cmh.currency, m_start), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'reactivation' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    bool_or(cmh.is_estimated)
  FROM public.client_mrr_history cmh
  WHERE cmh.snapshot_month = m_start;
END $$;

-- 12. Backfill helper
CREATE OR REPLACE FUNCTION public.backfill_mrr_snapshots(_months integer DEFAULT 24)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i integer;
  m date;
  cnt integer := 0;
BEGIN
  FOR i IN REVERSE (_months - 1)..0 LOOP
    m := (date_trunc('month', CURRENT_DATE) - (i || ' months')::interval)::date;
    PERFORM public.recompute_mrr_for_month(m);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;

-- 13. Auto-churn paused > N days
CREATE OR REPLACE FUNCTION public.auto_churn_paused_clients()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
           ROUND(public.effective_monthly_fee(u.id) * COALESCE(public.get_exchange_rate(u.fee_currency, CURRENT_DATE),0), 2)
      FROM upd u
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM ev;
  RETURN affected;
END $$;

-- 14. Views
CREATE OR REPLACE VIEW public.v_mrr_actual AS
SELECT snapshot_month, currency, is_consolidated, mrr_amount,
       active_clients_count, new_mrr, expansion_mrr, contraction_mrr,
       churn_mrr, reactivation_mrr, net_new_mrr, is_estimated, computed_at
  FROM public.mrr_snapshots
 ORDER BY snapshot_month DESC, currency;

CREATE OR REPLACE VIEW public.v_client_metrics AS
SELECT
  c.id AS client_id,
  c.company_name,
  c.country_id,
  c.fee_currency AS currency,
  c.status,
  c.activated_at,
  c.churned_at,
  c.assigned_executive_id,
  public.effective_monthly_fee(c.id) AS current_mrr,
  ROUND(public.effective_monthly_fee(c.id) * COALESCE(public.get_exchange_rate(c.fee_currency, CURRENT_DATE), 0), 2) AS current_mrr_usd,
  CASE
    WHEN c.activated_at IS NULL THEN 0
    ELSE GREATEST(0,
      EXTRACT(YEAR FROM age(COALESCE(c.churned_at, CURRENT_DATE), c.activated_at))*12
      + EXTRACT(MONTH FROM age(COALESCE(c.churned_at, CURRENT_DATE), c.activated_at))
    )
  END AS lifetime_months,
  (SELECT COALESCE(SUM(mi.amount), 0)
     FROM public.monthly_invoices mi
    WHERE mi.client_id = c.id AND mi.status IN ('invoiced','paid')) AS total_revenue_client_currency
FROM public.clients c;

CREATE OR REPLACE VIEW public.v_churn_summary_monthly AS
SELECT
  date_trunc('month', ce.churned_at)::date AS month,
  ce.currency,
  ce.reason_code,
  COUNT(*) AS churn_count,
  SUM(ce.mrr_lost) AS mrr_lost,
  SUM(ce.mrr_lost_usd) AS mrr_lost_usd
FROM public.churn_events ce
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

-- 15. analytics_reader role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_reader') THEN
    CREATE ROLE analytics_reader NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT SELECT ON public.v_mrr_actual TO analytics_reader;
GRANT SELECT ON public.v_client_metrics TO analytics_reader;
GRANT SELECT ON public.v_churn_summary_monthly TO analytics_reader;

-- 16. Enable pg_cron + pg_net for scheduled refresh of current month
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
