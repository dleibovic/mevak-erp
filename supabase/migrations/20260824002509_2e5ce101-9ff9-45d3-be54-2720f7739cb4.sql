-- ============================================================================
-- Mevak · Facturación por marca/submarca (multi razón social) + anulación
-- ============================================================================

-- 1) SUBMARCAS como entidades de facturación (razón social propia)
ALTER TABLE public.client_sub_brands
  ADD COLUMN IF NOT EXISTS legal_name       text,
  ADD COLUMN IF NOT EXISTS tax_id           text,
  ADD COLUMN IF NOT EXISTS payment_channel  public.payment_channel,
  ADD COLUMN IF NOT EXISTS billing_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_separately  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client_sub_brands.bill_separately IS
  'Si true, la submarca genera su propia factura mensual con su razón social y monto.';

-- 2) monthly_invoices: soporte multi-razón social + anulación (tachado)
ALTER TABLE public.monthly_invoices
  ADD COLUMN IF NOT EXISTS sub_brand_id uuid REFERENCES public.client_sub_brands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS legal_name   text,
  ADD COLUMN IF NOT EXISTS tax_id       text,
  ADD COLUMN IF NOT EXISTS voided_at    timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by    uuid REFERENCES auth.users(id);

ALTER TABLE public.monthly_invoices
  DROP CONSTRAINT IF EXISTS monthly_invoices_client_id_period_month_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_invoices_client_period_entity
  ON public.monthly_invoices
     (client_id, period_month, COALESCE(sub_brand_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 3) invoices (solapa Facturas): fecha de factura editable + submarca + anulación
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS sub_brand_id uuid REFERENCES public.client_sub_brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legal_name   text,
  ADD COLUMN IF NOT EXISTS tax_id       text,
  ADD COLUMN IF NOT EXISTS voided_at    timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by    uuid REFERENCES auth.users(id);

-- 4) Generación mensual: 1 factura matriz + 1 por submarca facturable
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(
  _period date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer := 0;
  n integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 4a) Cliente matriz
  INSERT INTO public.monthly_invoices
    (client_id, sub_brand_id, billing_user_id, period_month, amount, currency, payment_channel, legal_name, tax_id, status)
  SELECT c.id, NULL, c.billing_user_id, _period,
         public.effective_monthly_fee(c.id),
         c.fee_currency, c.payment_channel, c.legal_name, c.tax_id, 'pending'
  FROM public.clients c
  WHERE c.status = 'active'
  ON CONFLICT (client_id, period_month, COALESCE(sub_brand_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; inserted_count := inserted_count + n;

  -- 4b) Submarcas "facturar por separado"
  INSERT INTO public.monthly_invoices
    (client_id, sub_brand_id, billing_user_id, period_month, amount, currency, payment_channel, legal_name, tax_id, status)
  SELECT sb.client_id, sb.id, COALESCE(sb.billing_user_id, c.billing_user_id), _period,
         sb.monthly_fee, sb.fee_currency,
         COALESCE(sb.payment_channel, c.payment_channel),
         COALESCE(NULLIF(sb.legal_name,''), sb.name), sb.tax_id, 'pending'
  FROM public.client_sub_brands sb
  JOIN public.clients c ON c.id = sb.client_id
  WHERE c.status = 'active' AND sb.status = 'active' AND sb.bill_separately = true
  ON CONFLICT (client_id, period_month, COALESCE(sub_brand_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; inserted_count := inserted_count + n;

  RETURN inserted_count;
END $function$;

-- 5) BLINDAJE MRR: el snapshot mensual sigue tomando SOLO la factura matriz
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
      ON mi.client_id = c.id AND mi.period_month = m_start AND mi.sub_brand_id IS NULL
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