-- CLIENTES: plazo de vencimiento en días (default 5) + tipo de factura B/N
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS payment_term_days integer NOT NULL DEFAULT 5
  CHECK (payment_term_days >= 0);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS invoice_letter text
  CHECK (invoice_letter IN ('B','N'));

-- FACTURACIÓN MENSUAL: fecha de factura + vencimiento
ALTER TABLE public.monthly_invoices ADD COLUMN IF NOT EXISTS invoice_date date;
ALTER TABLE public.monthly_invoices ADD COLUMN IF NOT EXISTS due_date date;

CREATE OR REPLACE FUNCTION public.set_monthly_invoice_dates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE term integer;
BEGIN
  IF NEW.invoice_date IS NULL THEN
    NEW.invoice_date := NEW.period_month;
  END IF;
  SELECT payment_term_days INTO term FROM public.clients WHERE id = NEW.client_id;
  NEW.due_date := NEW.invoice_date + COALESCE(term, 5);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_monthly_invoice_dates ON public.monthly_invoices;

CREATE TRIGGER trg_monthly_invoice_dates
BEFORE INSERT OR UPDATE OF invoice_date, client_id, period_month ON public.monthly_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_monthly_invoice_dates();

UPDATE public.monthly_invoices SET invoice_date = period_month WHERE invoice_date IS NULL;