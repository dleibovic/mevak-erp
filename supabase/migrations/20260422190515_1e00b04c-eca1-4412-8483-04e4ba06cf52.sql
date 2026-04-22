
-- Provinces & Cities catalogs
CREATE TABLE public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name)
);

CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_id, name)
);

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read provinces" ON public.provinces FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write provinces" ON public.provinces FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "auth read cities" ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write cities" ON public.cities FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Extend clients
ALTER TABLE public.clients
  ADD COLUMN monthly_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN fee_currency text NOT NULL DEFAULT 'ARS',
  ADD COLUMN cmv_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN cmv_currency text NOT NULL DEFAULT 'ARS',
  ADD COLUMN branches_count integer NOT NULL DEFAULT 1,
  ADD COLUMN contact_name text,
  ADD COLUMN contact_phone text,
  ADD COLUMN contact_email text,
  ADD COLUMN reports_email text,
  ADD COLUMN province_id uuid REFERENCES public.provinces(id) ON DELETE SET NULL,
  ADD COLUMN city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD COLUMN address text,
  ADD COLUMN notes text;

-- Remove cmv_cost from client_platforms (CMV is now per client)
ALTER TABLE public.client_platforms DROP COLUMN cmv_cost;

-- Seed provinces & cities
DO $$
DECLARE
  arg_id uuid;
  esp_id uuid;
  prov_id uuid;
BEGIN
  SELECT id INTO arg_id FROM public.countries WHERE currency_code = 'ARS' LIMIT 1;
  SELECT id INTO esp_id FROM public.countries WHERE currency_code = 'EUR' LIMIT 1;

  IF arg_id IS NOT NULL THEN
    INSERT INTO public.provinces (country_id, name) VALUES
      (arg_id, 'CABA'), (arg_id, 'Buenos Aires'), (arg_id, 'Córdoba'),
      (arg_id, 'Santa Fe'), (arg_id, 'Mendoza'), (arg_id, 'Tucumán'),
      (arg_id, 'Salta'), (arg_id, 'Entre Ríos'), (arg_id, 'Neuquén'),
      (arg_id, 'Río Negro'), (arg_id, 'Misiones'), (arg_id, 'Chaco')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = arg_id AND name = 'CABA';
    INSERT INTO public.cities (province_id, name) VALUES (prov_id, 'CABA') ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = arg_id AND name = 'Buenos Aires';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'La Plata'), (prov_id, 'Mar del Plata'), (prov_id, 'Bahía Blanca'),
      (prov_id, 'San Isidro'), (prov_id, 'Quilmes'), (prov_id, 'Tigre')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = arg_id AND name = 'Córdoba';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Córdoba Capital'), (prov_id, 'Villa Carlos Paz'), (prov_id, 'Río Cuarto')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = arg_id AND name = 'Santa Fe';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Rosario'), (prov_id, 'Santa Fe Capital')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = arg_id AND name = 'Mendoza';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Mendoza Capital'), (prov_id, 'Godoy Cruz')
    ON CONFLICT DO NOTHING;
  END IF;

  IF esp_id IS NOT NULL THEN
    INSERT INTO public.provinces (country_id, name) VALUES
      (esp_id, 'Madrid'), (esp_id, 'Barcelona'), (esp_id, 'Valencia'),
      (esp_id, 'Sevilla'), (esp_id, 'Málaga'), (esp_id, 'Bilbao'),
      (esp_id, 'Zaragoza'), (esp_id, 'Alicante'), (esp_id, 'Granada')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = esp_id AND name = 'Madrid';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Madrid'), (prov_id, 'Alcalá de Henares'), (prov_id, 'Getafe')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = esp_id AND name = 'Barcelona';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Barcelona'), (prov_id, 'Hospitalet de Llobregat'), (prov_id, 'Badalona')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = esp_id AND name = 'Valencia';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Valencia'), (prov_id, 'Gandía')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = esp_id AND name = 'Sevilla';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Sevilla'), (prov_id, 'Dos Hermanas')
    ON CONFLICT DO NOTHING;

    SELECT id INTO prov_id FROM public.provinces WHERE country_id = esp_id AND name = 'Málaga';
    INSERT INTO public.cities (province_id, name) VALUES
      (prov_id, 'Málaga'), (prov_id, 'Marbella')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
