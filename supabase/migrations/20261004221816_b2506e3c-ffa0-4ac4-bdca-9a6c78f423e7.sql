CREATE OR REPLACE FUNCTION public.mark_invoiced_on_afip_doc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.kind = 'afip' THEN
    UPDATE public.monthly_invoices
       SET status = 'invoiced'
     WHERE id = NEW.invoice_id
       AND status = 'pending'
       AND voided_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_afip_doc_marks_invoiced ON public.invoice_documents;

CREATE TRIGGER trg_afip_doc_marks_invoiced
AFTER INSERT ON public.invoice_documents
FOR EACH ROW
EXECUTE FUNCTION public.mark_invoiced_on_afip_doc();