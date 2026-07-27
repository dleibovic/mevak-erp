BEGIN;

DROP POLICY IF EXISTS "auth read audit_log" ON public.audit_log;

DROP POLICY IF EXISTS "auth read mrr_recompute_runs" ON public.mrr_recompute_runs;

DROP POLICY IF EXISTS "auth read mrr_snapshots" ON public.mrr_snapshots;
CREATE POLICY "staff read mrr_snapshots" ON public.mrr_snapshots
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'executive'));

DROP POLICY IF EXISTS "auth read app_settings" ON public.app_settings;
CREATE POLICY "staff read app_settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'executive'));

DROP POLICY IF EXISTS "auth read exchange_rates" ON public.exchange_rates;
CREATE POLICY "staff read exchange_rates" ON public.exchange_rates
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'executive'));

DROP POLICY IF EXISTS "auth read exchange_rate_overrides" ON public.exchange_rate_overrides;
CREATE POLICY "staff read exchange_rate_overrides" ON public.exchange_rate_overrides
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'executive'));

DROP POLICY IF EXISTS "auth read ranges" ON public.exchange_rate_validation_ranges;
CREATE POLICY "staff read exchange_rate_validation_ranges" ON public.exchange_rate_validation_ranges
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'executive'));

DROP POLICY IF EXISTS "auth read alert_settings" ON public.alert_settings;
CREATE POLICY "staff read alert_settings" ON public.alert_settings
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'executive'));

COMMIT;