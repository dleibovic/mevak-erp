
-- Make views security_invoker so they respect caller's RLS
ALTER VIEW public.v_mrr_actual SET (security_invoker = true);
ALTER VIEW public.v_client_metrics SET (security_invoker = true);
ALTER VIEW public.v_churn_summary_monthly SET (security_invoker = true);

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.recompute_mrr_for_month(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.backfill_mrr_snapshots(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_churn_paused_clients() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_exchange_rate(text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clients_status_lifecycle() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clients_emit_churn_event() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_exchange_rate(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_mrr_for_month(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_mrr_snapshots(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_churn_paused_clients() TO authenticated;
