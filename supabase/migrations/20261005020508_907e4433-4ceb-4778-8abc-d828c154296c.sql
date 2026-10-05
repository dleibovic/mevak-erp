ALTER TABLE public.monthly_invoices ADD COLUMN IF NOT EXISTS incobrable_at timestamptz, ADD COLUMN IF NOT EXISTS incobrable_reason text;

CREATE OR REPLACE FUNCTION public.mark_invoice_incobrable(_invoice_id uuid, _usd_full numeric, _origin_rate numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  inv record;
  emp_bal numeric;
  cname text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.monthly_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La factura no existe'; END IF;
  IF inv.voided_at IS NOT NULL THEN RAISE EXCEPTION 'La factura está anulada'; END IF;
  IF inv.incobrable_at IS NOT NULL THEN RAISE EXCEPTION 'La factura ya está marcada como incobrable'; END IF;
  IF _usd_full IS NULL OR _usd_full <= 0 THEN RAISE EXCEPTION 'El valor en USD debe ser mayor a 0'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'El motivo es obligatorio'; END IF;

  UPDATE public.monthly_invoices
     SET incobrable_at = now(), incobrable_reason = _reason, voided_at = now(), voided_by = auth.uid()
   WHERE id = _invoice_id;

  SELECT COALESCE(SUM(amount_usd),0) INTO emp_bal FROM public.partner_debts
   WHERE related_invoice_id = _invoice_id AND ledger = 'empresa';
  IF emp_bal > 0 THEN
    INSERT INTO public.partner_debts(ledger, currency, amount_usd, entry_type, concept, related_invoice_id, created_by)
    VALUES ('empresa','USD',-emp_bal,'adjustment','Reversa empresa por incobrable',_invoice_id,auth.uid());
  END IF;

  SELECT name INTO cname FROM public.clients WHERE id = inv.client_id;

  INSERT INTO public.partner_debts(ledger, currency, amount_usd, entry_type, origin_period, origin_rate_ars, amount_ars_origin, related_invoice_id, concept, created_by)
  VALUES ('meri','USD',round(_usd_full/2,2),'incobrable_split',inv.period_month,_origin_rate,
    CASE WHEN inv.currency = 'ARS' THEN inv.amount - COALESCE(inv.amount_paid,0) ELSE NULL END,
    _invoice_id,
    'Incobrable '||COALESCE(cname,'cliente')||' '||to_char(inv.period_month,'YYYY-MM')||' — mitad 50/50',
    auth.uid());
END $$;

REVOKE EXECUTE ON FUNCTION public.mark_invoice_incobrable(uuid, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_incobrable(uuid, numeric, numeric, text) TO authenticated;