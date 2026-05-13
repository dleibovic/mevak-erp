
-- ====== ENUMS ======
DO $$ BEGIN
  CREATE TYPE public.payment_channel AS ENUM (
    'stripe_dario','us_dario','maria_transferencia','maria_efectivo','dario_transferencia','dario_efectivo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.discount_duration AS ENUM ('30_days','60_days','90_days','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.price_change_type AS ENUM (
    'increase','decrease','discount_applied','discount_expired','manual_adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.monthly_invoice_status AS ENUM ('pending','invoiced','paid','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====== ALTER clients ======
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS payment_channel public.payment_channel,
  ADD COLUMN IF NOT EXISTS billing_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  ADD COLUMN IF NOT EXISTS discount_starts_at date,
  ADD COLUMN IF NOT EXISTS discount_ends_at date,
  ADD COLUMN IF NOT EXISTS discount_duration public.discount_duration,
  ADD COLUMN IF NOT EXISTS discount_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ====== ALTER prospects ======
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS discount_percentage numeric CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  ADD COLUMN IF NOT EXISTS discount_starts_at date,
  ADD COLUMN IF NOT EXISTS discount_ends_at date,
  ADD COLUMN IF NOT EXISTS discount_duration public.discount_duration;

-- ====== effective_monthly_fee ======
CREATE OR REPLACE FUNCTION public.effective_monthly_fee(_client_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN c.discount_active
      AND c.discount_percentage IS NOT NULL
      AND (c.discount_ends_at IS NULL OR c.discount_ends_at >= CURRENT_DATE)
    THEN ROUND(c.monthly_fee * (1 - c.discount_percentage/100.0), 2)
    ELSE c.monthly_fee
  END
  FROM public.clients c WHERE c.id = _client_id;
$$;

-- ====== monthly_invoices ======
CREATE TABLE IF NOT EXISTS public.monthly_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  billing_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  period_month date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ARS',
  payment_channel public.payment_channel,
  status public.monthly_invoice_status NOT NULL DEFAULT 'pending',
  invoiced_at timestamptz,
  invoiced_by uuid REFERENCES auth.users(id),
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_invoices_user_period ON public.monthly_invoices(billing_user_id, period_month);
CREATE INDEX IF NOT EXISTS idx_monthly_invoices_period ON public.monthly_invoices(period_month);

ALTER TABLE public.monthly_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage monthly_invoices" ON public.monthly_invoices;
CREATE POLICY "admin manage monthly_invoices" ON public.monthly_invoices
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user read own monthly_invoices" ON public.monthly_invoices;
CREATE POLICY "user read own monthly_invoices" ON public.monthly_invoices
  FOR SELECT TO authenticated USING (billing_user_id = auth.uid());

DROP POLICY IF EXISTS "user update own monthly_invoices" ON public.monthly_invoices;
CREATE POLICY "user update own monthly_invoices" ON public.monthly_invoices
  FOR UPDATE TO authenticated USING (billing_user_id = auth.uid()) WITH CHECK (billing_user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_monthly_invoices_updated ON public.monthly_invoices;
CREATE TRIGGER trg_monthly_invoices_updated BEFORE UPDATE ON public.monthly_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- ====== client_price_history ======
CREATE TABLE IF NOT EXISTS public.client_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  change_type public.price_change_type NOT NULL,
  previous_amount numeric,
  new_amount numeric,
  currency text,
  percentage_change numeric GENERATED ALWAYS AS (
    CASE WHEN previous_amount IS NOT NULL AND previous_amount <> 0
      THEN ROUND(((new_amount - previous_amount) / previous_amount) * 100, 2)
      ELSE NULL END
  ) STORED,
  reason text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  discount_duration public.discount_duration,
  discount_ends_at date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cph_client_created ON public.client_price_history(client_id, created_at DESC);

ALTER TABLE public.client_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage cph" ON public.client_price_history;
CREATE POLICY "admin manage cph" ON public.client_price_history
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "exec read cph" ON public.client_price_history;
CREATE POLICY "exec read cph" ON public.client_price_history
  FOR SELECT TO authenticated USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.assigned_executive_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
         OR c.billing_user_id = auth.uid()
    )
  );

-- ====== Trigger price history on clients UPDATE ======
CREATE OR REPLACE FUNCTION public.clients_log_price_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acting uuid;
BEGIN
  BEGIN acting := COALESCE(NULLIF(current_setting('app.acting_user', true), '')::uuid, auth.uid());
  EXCEPTION WHEN others THEN acting := auth.uid(); END;

  -- Fee change
  IF NEW.monthly_fee IS DISTINCT FROM OLD.monthly_fee THEN
    INSERT INTO public.client_price_history(client_id, change_type, previous_amount, new_amount, currency, created_by, effective_date)
    VALUES (
      NEW.id,
      CASE WHEN NEW.monthly_fee > COALESCE(OLD.monthly_fee, 0) THEN 'increase'::price_change_type
           WHEN NEW.monthly_fee < COALESCE(OLD.monthly_fee, 0) THEN 'decrease'::price_change_type
           ELSE 'manual_adjustment'::price_change_type END,
      OLD.monthly_fee, NEW.monthly_fee, NEW.fee_currency, acting, CURRENT_DATE
    );
  END IF;

  -- Discount activated
  IF (NEW.discount_active = true AND COALESCE(OLD.discount_active, false) = false)
     OR (NEW.discount_active = true AND NEW.discount_percentage IS DISTINCT FROM OLD.discount_percentage) THEN
    INSERT INTO public.client_price_history(client_id, change_type, previous_amount, new_amount, currency, discount_duration, discount_ends_at, created_by)
    VALUES (
      NEW.id, 'discount_applied'::price_change_type,
      NEW.monthly_fee,
      ROUND(NEW.monthly_fee * (1 - COALESCE(NEW.discount_percentage,0)/100.0), 2),
      NEW.fee_currency, NEW.discount_duration, NEW.discount_ends_at, acting
    );
  END IF;

  -- Discount expired/disabled
  IF COALESCE(OLD.discount_active, false) = true AND NEW.discount_active = false THEN
    INSERT INTO public.client_price_history(client_id, change_type, previous_amount, new_amount, currency, created_by)
    VALUES (
      NEW.id, 'discount_expired'::price_change_type,
      ROUND(NEW.monthly_fee * (1 - COALESCE(OLD.discount_percentage,0)/100.0), 2),
      NEW.monthly_fee, NEW.fee_currency, acting
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clients_price_history ON public.clients;
CREATE TRIGGER trg_clients_price_history
AFTER UPDATE OF monthly_fee, discount_percentage, discount_active ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_log_price_history();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- ====== notifications ======
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user read own notifications" ON public.notifications;
CREATE POLICY "user read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user update own notifications" ON public.notifications;
CREATE POLICY "user update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin manage notifications" ON public.notifications;
CREATE POLICY "admin manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ====== Allow billing_user to read assigned clients ======
DROP POLICY IF EXISTS "billing user read clients" ON public.clients;
CREATE POLICY "billing user read clients" ON public.clients
  FOR SELECT TO authenticated USING (billing_user_id = auth.uid());

-- ====== generate monthly invoices RPC (used by cron and on-demand) ======
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(_period date DEFAULT date_trunc('month', CURRENT_DATE)::date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  INSERT INTO public.monthly_invoices (client_id, billing_user_id, period_month, amount, currency, payment_channel, status)
  SELECT c.id, c.billing_user_id, _period,
         public.effective_monthly_fee(c.id),
         c.fee_currency, c.payment_channel, 'pending'
  FROM public.clients c
  WHERE c.status = 'active'
  ON CONFLICT (client_id, period_month) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $$;

-- ====== expire discounts RPC ======
CREATE OR REPLACE FUNCTION public.expire_discounts()
RETURNS TABLE(client_id uuid, company_name text, billing_user_id uuid, currency text, previous_amount numeric, new_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH expiring AS (
    SELECT c.id, c.company_name, c.billing_user_id, c.fee_currency,
           ROUND(c.monthly_fee * (1 - COALESCE(c.discount_percentage,0)/100.0), 2) AS prev_amount,
           c.monthly_fee AS new_amount
    FROM public.clients c
    WHERE c.discount_active = true
      AND c.discount_ends_at IS NOT NULL
      AND c.discount_ends_at < CURRENT_DATE
  ),
  upd AS (
    UPDATE public.clients c
       SET discount_active = false
      FROM expiring e
     WHERE c.id = e.id
    RETURNING c.id
  ),
  -- Recalculate current-month pending invoice amount
  recalc AS (
    UPDATE public.monthly_invoices mi
       SET amount = e.new_amount, updated_at = now()
      FROM expiring e
     WHERE mi.client_id = e.id
       AND mi.period_month = date_trunc('month', CURRENT_DATE)::date
       AND mi.status = 'pending'
    RETURNING mi.id
  )
  SELECT e.id, e.company_name, e.billing_user_id, e.fee_currency, e.prev_amount, e.new_amount FROM expiring e;
END $$;
