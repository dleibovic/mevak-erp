BEGIN;

DROP TRIGGER IF EXISTS trg_clients_emit_churn_event   ON public.clients;
DROP TRIGGER IF EXISTS trg_clients_log_price_history  ON public.clients;
DROP TRIGGER IF EXISTS trg_clients_status_lifecycle   ON public.clients;

CREATE OR REPLACE FUNCTION public.clients_emit_churn_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  acting uuid;
  fee numeric;
  reason public.churn_reason_code;
  detail text;
BEGIN
  IF NEW.status = 'churned' AND OLD.status IS DISTINCT FROM 'churned' THEN
    BEGIN acting := COALESCE(NULLIF(current_setting('app.acting_user', true), '')::uuid, auth.uid());
    EXCEPTION WHEN others THEN acting := auth.uid(); END;

    BEGIN
      reason := COALESCE(NULLIF(current_setting('app.churn_reason', true), ''), 'manual')::public.churn_reason_code;
    EXCEPTION WHEN others THEN reason := 'manual'; END;

    detail := NULLIF(current_setting('app.churn_detail', true), '');

    fee := public.effective_monthly_fee(NEW.id);
    INSERT INTO public.churn_events (client_id, churned_at, reason_code, reason_detail, mrr_lost, currency, mrr_lost_usd, created_by)
    VALUES (NEW.id, COALESCE(NEW.churned_at, CURRENT_DATE), reason, detail, fee, NEW.fee_currency,
            public.to_usd(fee, NEW.fee_currency, CURRENT_DATE),
            acting);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.auto_churn_paused_clients()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  threshold integer;
  affected integer := 0;
BEGIN
  SELECT paused_to_churned_days INTO threshold FROM public.app_settings WHERE id = 1;

  PERFORM set_config('app.churn_reason',  'paused_timeout', true);
  PERFORM set_config('app.churn_detail',  'auto: paused > ' || threshold || ' days', true);

  WITH upd AS (
    UPDATE public.clients
       SET status = 'churned', churned_at = CURRENT_DATE
     WHERE status = 'paused'
       AND paused_at IS NOT NULL
       AND paused_at < CURRENT_DATE - threshold
    RETURNING id
  )
  SELECT count(*) INTO affected FROM upd;

  PERFORM set_config('app.churn_reason', '', true);
  PERFORM set_config('app.churn_detail', '', true);

  RETURN affected;
END $function$;

REVOKE EXECUTE ON FUNCTION public.auto_churn_paused_clients() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.auto_churn_paused_clients() TO service_role;

COMMIT;