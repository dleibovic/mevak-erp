
-- 1) Add admin guard to generate_monthly_invoices (keep existing body)
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(_period date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- Allow service_role (auth.uid() IS NULL) or admins only
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.monthly_invoices (client_id, billing_user_id, period_month, amount, currency, payment_channel, status)
  SELECT c.id, c.billing_user_id, _period,
         public.effective_monthly_fee(c.id),
         c.fee_currency, c.payment_channel, 'pending'
  FROM public.clients c
  WHERE c.status = 'active'
  ON CONFLICT (client_id, period_month) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $function$;

-- 2) Revoke direct execution from anon/authenticated on internal-only RPCs.
--    Edge functions (service_role) and DB owner retain access.
REVOKE EXECUTE ON FUNCTION public.expire_discounts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_mrr_snapshots(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_churn_paused_clients() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_mrr_for_month(date) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.expire_discounts() TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_mrr_snapshots(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_churn_paused_clients() TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_mrr_for_month(date) TO service_role;

-- 3) Also revoke anon access from generate_monthly_invoices (only authenticated admins + service_role)
REVOKE EXECUTE ON FUNCTION public.generate_monthly_invoices(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices(date) TO authenticated, service_role;
