
-- Helper macro pattern repeated per function signature
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

revoke execute on function public.refresh_invoice_statuses() from public, anon;
grant execute on function public.refresh_invoice_statuses() to authenticated;

revoke execute on function public.handle_new_user() from public, anon;
-- handle_new_user runs as trigger on auth.users; no grant to authenticated needed

revoke execute on function public.expire_discounts() from public, anon;
grant execute on function public.expire_discounts() to authenticated;

revoke execute on function public.effective_monthly_fee(uuid) from public, anon;
grant execute on function public.effective_monthly_fee(uuid) to authenticated;

revoke execute on function public.generate_monthly_invoices(date) from public, anon;
grant execute on function public.generate_monthly_invoices(date) to authenticated;

revoke execute on function public.get_exchange_rate(text, date) from public, anon;
grant execute on function public.get_exchange_rate(text, date) to authenticated;

revoke execute on function public.backfill_mrr_snapshots(integer) from public, anon;
grant execute on function public.backfill_mrr_snapshots(integer) to authenticated;

revoke execute on function public.auto_churn_paused_clients() from public, anon;
grant execute on function public.auto_churn_paused_clients() to authenticated;

revoke execute on function public.to_usd(numeric, text, date) from public, anon;
grant execute on function public.to_usd(numeric, text, date) to authenticated;

revoke execute on function public.start_mrr_recompute(integer) from public, anon;
grant execute on function public.start_mrr_recompute(integer) to authenticated;

revoke execute on function public.recompute_mrr_for_month(date) from public, anon;
grant execute on function public.recompute_mrr_for_month(date) to authenticated;

revoke execute on function public.upsert_exchange_rate_override(text, date, numeric, boolean, text) from public, anon;
grant execute on function public.upsert_exchange_rate_override(text, date, numeric, boolean, text) to authenticated;

revoke execute on function public.prorated_mrr(numeric, date, date, date) from public, anon;
grant execute on function public.prorated_mrr(numeric, date, date, date) to authenticated;

-- Trigger functions: revoke from anon/public (no caller invokes them directly)
revoke execute on function public.clients_log_price_history() from public, anon;
revoke execute on function public.clients_status_lifecycle() from public, anon;
revoke execute on function public.clients_emit_churn_event() from public, anon;
revoke execute on function public.exchange_override_invalidate_snapshot() from public, anon;
revoke execute on function public.clients_validate_activated_at() from public, anon;
revoke execute on function public.set_row_updated_at() from public, anon;
