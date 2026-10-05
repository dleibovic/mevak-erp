CREATE OR REPLACE FUNCTION public.undo_invoice_incobrable(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv public.monthly_invoices%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _inv FROM public.monthly_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;
  IF _inv.incobrable_at IS NULL THEN
    RAISE EXCEPTION 'La factura no está marcada como incobrable';
  END IF;

  UPDATE public.monthly_invoices
  SET incobrable_at = NULL,
      incobrable_reason = NULL,
      voided_at = NULL,
      voided_by = NULL
  WHERE id = _invoice_id;

  DELETE FROM public.partner_debts
  WHERE related_invoice_id = _invoice_id
    AND (
      entry_type = 'incobrable_split'
      OR (entry_type = 'adjustment' AND ledger = 'empresa' AND concept = 'Reversa empresa por incobrable')
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.undo_invoice_incobrable(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.undo_invoice_incobrable(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.undo_invoice_incobrable(uuid) TO authenticated;