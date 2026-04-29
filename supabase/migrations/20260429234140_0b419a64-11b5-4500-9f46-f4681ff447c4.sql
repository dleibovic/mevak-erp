CREATE TABLE public.food_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.food_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read food_categories"
ON public.food_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin write food_categories"
ON public.food_categories
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.clients
ADD COLUMN food_category_id UUID REFERENCES public.food_categories(id);

CREATE INDEX idx_clients_food_category_id ON public.clients(food_category_id);

CREATE TABLE public.client_sub_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country_id UUID NOT NULL REFERENCES public.countries(id),
  province_id UUID REFERENCES public.provinces(id),
  city_id UUID REFERENCES public.cities(id),
  address TEXT,
  billing_frequency public.billing_frequency NOT NULL DEFAULT 'monthly',
  status public.client_status NOT NULL DEFAULT 'active',
  monthly_fee NUMERIC NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'ARS',
  cmv_cost NUMERIC NOT NULL DEFAULT 0,
  cmv_currency TEXT NOT NULL DEFAULT 'ARS',
  branches_count INTEGER NOT NULL DEFAULT 1,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  reports_email TEXT,
  notes TEXT,
  food_category_id UUID REFERENCES public.food_categories(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_sub_brands_client_id ON public.client_sub_brands(client_id);
CREATE INDEX idx_client_sub_brands_country_id ON public.client_sub_brands(country_id);
CREATE INDEX idx_client_sub_brands_food_category_id ON public.client_sub_brands(food_category_id);

ALTER TABLE public.client_sub_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage client_sub_brands"
ON public.client_sub_brands
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "exec read assigned client_sub_brands"
ON public.client_sub_brands
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id
    FROM public.clients c
    WHERE c.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
);

INSERT INTO public.food_categories (name)
VALUES
  ('Pizzería'),
  ('Hamburguesería'),
  ('Heladería'),
  ('Cafetería'),
  ('Panadería'),
  ('Pastelería'),
  ('Sushi'),
  ('Comida rápida'),
  ('Parrilla'),
  ('Restaurante'),
  ('Cervecería'),
  ('Sandwichería'),
  ('Empanadas'),
  ('Comida saludable'),
  ('Pollo'),
  ('Mexicana'),
  ('Italiana'),
  ('Árabe')
ON CONFLICT (name) DO NOTHING;