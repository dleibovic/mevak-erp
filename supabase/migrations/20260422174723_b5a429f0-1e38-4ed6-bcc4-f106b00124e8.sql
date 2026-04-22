
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'executive');
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.billing_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE public.invoice_status AS ENUM ('pending', 'overdue', 'paid');
CREATE TYPE public.invoice_type AS ENUM ('formal', 'cash');
CREATE TYPE public.collector AS ENUM ('dario', 'maria');
CREATE TYPE public.expense_assignee AS ENUM ('dario', 'maria', 'company');
CREATE TYPE public.recurrence_frequency AS ENUM ('weekly', 'monthly', 'annual');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- ============ CORE TABLES ============
CREATE TABLE public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  currency_code TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  country_id UUID REFERENCES public.countries(id),
  base_salary NUMERIC(14,2) DEFAULT 0,
  salary_currency TEXT NOT NULL DEFAULT 'ARS',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  country_id UUID NOT NULL REFERENCES public.countries(id),
  billing_frequency billing_frequency NOT NULL DEFAULT 'monthly',
  status client_status NOT NULL DEFAULT 'active',
  assigned_executive_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.client_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES public.platforms(id),
  commission_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  cmv_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  UNIQUE (client_id, platform_id)
);

CREATE TABLE public.client_executive_commission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  commission_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ARS',
  UNIQUE (client_id, employee_id)
);

-- ============ BILLING ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  due_date DATE NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  invoice_type invoice_type NOT NULL DEFAULT 'formal',
  collected_by collector,
  collected_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  assigned_to expense_assignee NOT NULL DEFAULT 'company',
  paid_by collector,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_frequency recurrence_frequency,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ACCOUNTING ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  -- First user becomes admin, rest executives
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'executive');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update invoice status to overdue
CREATE OR REPLACE FUNCTION public.refresh_invoice_statuses()
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.invoices SET status = 'overdue'
  WHERE status = 'pending' AND due_date < CURRENT_DATE;
$$;

-- ============ ENABLE RLS ============
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_executive_commission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- Catalogs: anyone authenticated can read; only admin writes
CREATE POLICY "auth read countries" ON public.countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write countries" ON public.countries FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "auth read platforms" ON public.platforms FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write platforms" ON public.platforms FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "auth read expense_categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write expense_categories" ON public.expense_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Profiles
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- User roles: only admins can read/write (prevents privilege escalation)
CREATE POLICY "admin manage user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Employees: admin full; executive can read own employee record
CREATE POLICY "admin manage employees" ON public.employees FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "exec read own employee" ON public.employees FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Clients: admin full; executive only assigned
CREATE POLICY "admin manage clients" ON public.clients FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "exec read assigned clients" ON public.clients FOR SELECT TO authenticated USING (
  assigned_executive_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY "admin manage client_platforms" ON public.client_platforms FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "exec read client_platforms" ON public.client_platforms FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE assigned_executive_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
);

CREATE POLICY "admin manage commissions" ON public.client_executive_commission FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "exec read own commissions" ON public.client_executive_commission FOR SELECT TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Invoices: admin full; executive read invoices of assigned clients
CREATE POLICY "admin manage invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "exec read invoices" ON public.invoices FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE assigned_executive_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
);

-- Expenses & transactions: admin only
CREATE POLICY "admin manage expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin manage transactions" ON public.transactions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
