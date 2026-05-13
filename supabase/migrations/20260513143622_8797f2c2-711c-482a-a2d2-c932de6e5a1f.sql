
REVOKE ALL ON FUNCTION public.generate_monthly_invoices(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_discounts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clients_log_price_history() FROM PUBLIC, anon, authenticated;
