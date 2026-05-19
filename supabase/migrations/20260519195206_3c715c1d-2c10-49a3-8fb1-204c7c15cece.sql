
CREATE OR REPLACE FUNCTION public.recompute_mrr_for_month(_period date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    CASE WHEN public.get_exchange_rate(cs.currency, m_start) IS NOT NULL
         THEN ROUND(cs.mrr_amount * public.get_exchange_rate(cs.currency, m_start), 2)
         ELSE NULL END,
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

  -- Per-currency snapshot
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

  -- Consolidated USD snapshot (always emit one even if zero)
  INSERT INTO public.mrr_snapshots
    (snapshot_month, currency, is_consolidated, mrr_amount, active_clients_count,
     new_mrr, expansion_mrr, contraction_mrr, churn_mrr, reactivation_mrr, is_estimated)
  SELECT
    m_start, 'USD', true,
    COALESCE(SUM(CASE WHEN cmh.movement_type <> 'churn' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COUNT(DISTINCT CASE WHEN cmh.mrr_amount > 0 THEN cmh.client_id END),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'new' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'expansion' AND cmh.delta > 0
                      THEN ROUND(cmh.delta * COALESCE(public.get_exchange_rate(cmh.currency, m_start),0), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'contraction'
                      THEN ROUND(-cmh.delta * COALESCE(public.get_exchange_rate(cmh.currency, m_start),0), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'churn'
                      THEN ROUND(-cmh.delta * COALESCE(public.get_exchange_rate(cmh.currency, m_start),0), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cmh.movement_type = 'reactivation' THEN cmh.mrr_amount_usd ELSE 0 END), 0),
    COALESCE(bool_or(cmh.is_estimated), NOT has_real_history)
  FROM public.client_mrr_history cmh
  WHERE cmh.snapshot_month = m_start;
END $$;
