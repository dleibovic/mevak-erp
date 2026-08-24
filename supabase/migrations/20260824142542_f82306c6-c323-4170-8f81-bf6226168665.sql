-- ============================================================================
-- Borrado lógico de submarcas y razones sociales (registro + volver atrás)
-- La fila NO se elimina: se marca deleted_at/deleted_by, se oculta de las
-- vistas y del cálculo, y se puede recuperar. Correr en Supabase (idempotente).
-- ============================================================================
BEGIN;

ALTER TABLE public.client_sub_brands
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.client_billing_entities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- effective_monthly_fee: sumar solo razones sociales activas y NO borradas
CREATE OR REPLACE FUNCTION public.effective_monthly_fee(_client_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.client_billing_entities be
                  WHERE be.client_id = c.id AND be.active AND be.deleted_at IS NULL)
      THEN (SELECT COALESCE(SUM(be.amount),0) FROM public.client_billing_entities be
             WHERE be.client_id = c.id AND be.active AND be.deleted_at IS NULL)
    WHEN c.discount_active
      AND c.discount_percentage IS NOT NULL
      AND (c.discount_ends_at IS NULL OR c.discount_ends_at >= CURRENT_DATE)
      THEN ROUND(c.monthly_fee * (1 - c.discount_percentage/100.0), 2)
    ELSE c.monthly_fee
  END
  FROM public.clients c WHERE c.id = _client_id;
$$;

-- generate_monthly_invoices: ignorar submarcas / razones sociales borradas
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(
  _period date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer := 0;
  n integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid())
     AND NOT public.has_role(auth.uid(), 'administracion') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 4a) Matriz: solo si el cliente NO tiene razones sociales activas
  INSERT INTO public.monthly_invoices
    (client_id, sub_brand_id, billing_entity_id, billing_user_id, period_month, amount, currency, payment_channel, legal_name, tax_id, status)
  SELECT c.id, NULL, NULL, c.billing_user_id, _period,
         public.effective_monthly_fee(c.id),
         c.fee_currency, c.payment_channel, c.legal_name, c.tax_id, 'pending'
  FROM public.clients c
  WHERE c.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM public.client_billing_entities be
                     WHERE be.client_id = c.id AND be.active AND be.deleted_at IS NULL)
  ON CONFLICT (client_id, period_month,
               COALESCE(sub_brand_id,      '00000000-0000-0000-0000-000000000000'::uuid),
               COALESCE(billing_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; inserted_count := inserted_count + n;

  -- 4b) Una factura por razón social activa
  INSERT INTO public.monthly_invoices
    (client_id, sub_brand_id, billing_entity_id, billing_user_id, period_month, amount, currency, payment_channel, legal_name, tax_id, status)
  SELECT be.client_id, NULL, be.id, COALESCE(be.billing_user_id, c.billing_user_id), _period,
         be.amount, be.currency, COALESCE(be.payment_channel, c.payment_channel),
         be.legal_name, be.tax_id, 'pending'
  FROM public.client_billing_entities be
  JOIN public.clients c ON c.id = be.client_id
  WHERE c.status = 'active' AND be.active AND be.deleted_at IS NULL
  ON CONFLICT (client_id, period_month,
               COALESCE(sub_brand_id,      '00000000-0000-0000-0000-000000000000'::uuid),
               COALESCE(billing_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; inserted_count := inserted_count + n;

  -- 4c) Submarcas "facturar por separado" (no borradas)
  INSERT INTO public.monthly_invoices
    (client_id, sub_brand_id, billing_entity_id, billing_user_id, period_month, amount, currency, payment_channel, legal_name, tax_id, status)
  SELECT sb.client_id, sb.id, NULL, COALESCE(sb.billing_user_id, c.billing_user_id), _period,
         sb.monthly_fee, sb.fee_currency,
         COALESCE(sb.payment_channel, c.payment_channel),
         COALESCE(NULLIF(sb.legal_name,''), sb.name), sb.tax_id, 'pending'
  FROM public.client_sub_brands sb
  JOIN public.clients c ON c.id = sb.client_id
  WHERE c.status = 'active' AND sb.status = 'active' AND sb.bill_separately = true AND sb.deleted_at IS NULL
  ON CONFLICT (client_id, period_month,
               COALESCE(sub_brand_id,      '00000000-0000-0000-0000-000000000000'::uuid),
               COALESCE(billing_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; inserted_count := inserted_count + n;

  RETURN inserted_count;
END $function$;

COMMIT;