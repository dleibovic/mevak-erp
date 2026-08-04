ALTER TABLE public.monthly_invoices ADD COLUMN IF NOT EXISTS payment_assigned_at timestamptz;

CREATE OR REPLACE FUNCTION public.monthly_invoices_payment_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    IF NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    IF NEW.paid_by IS NULL THEN NEW.paid_by := auth.uid(); END IF;
    NEW.payment_assigned_at := now();
  END IF;

  IF NEW.status IS DISTINCT FROM 'paid' AND OLD.status = 'paid' THEN
    NEW.paid_at := NULL; NEW.paid_by := NULL; NEW.payment_assigned_at := NULL;
  END IF;

  IF NEW.status = 'invoiced' AND OLD.status IS DISTINCT FROM 'invoiced' THEN
    IF NEW.invoiced_at IS NULL THEN NEW.invoiced_at := now(); END IF;
    IF NEW.invoiced_by IS NULL THEN NEW.invoiced_by := auth.uid(); END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_monthly_invoices_payment_audit ON public.monthly_invoices;
CREATE TRIGGER trg_monthly_invoices_payment_audit
BEFORE UPDATE OF status ON public.monthly_invoices
FOR EACH ROW EXECUTE FUNCTION public.monthly_invoices_payment_audit();