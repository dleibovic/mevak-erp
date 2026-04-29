DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'prospect_status'
  ) THEN
    CREATE TYPE public.prospect_status AS ENUM ('active', 'converted', 'lost');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'prospect_alert_type'
  ) THEN
    CREATE TYPE public.prospect_alert_type AS ENUM ('fixed_date', 'relative_days', 'inactivity_auto');
  END IF;
END $$;

ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'pending_setup';

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.contact_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  country_scope TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.lost_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reason TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  stage_order INTEGER NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  country_id UUID NOT NULL REFERENCES public.countries(id),
  city TEXT,
  estimated_monthly_revenue NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ARS',
  first_contact_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_contact_channel_id UUID REFERENCES public.contact_channels(id),
  current_stage_id UUID NOT NULL REFERENCES public.funnel_stages(id),
  assigned_executive_id UUID REFERENCES public.employees(id),
  lost_reason_id UUID REFERENCES public.lost_reasons(id),
  converted_to_client_id UUID REFERENCES public.clients(id),
  status public.prospect_status NOT NULL DEFAULT 'active',
  notes TEXT,
  stage_entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  created_by_employee_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.prospect_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES public.platforms(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, platform_id)
);

CREATE TABLE public.prospect_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id),
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  exited_at TIMESTAMP WITH TIME ZONE,
  changed_by_employee_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.prospect_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  interaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  channel_id UUID REFERENCES public.contact_channels(id),
  stage_at_interaction_id UUID REFERENCES public.funnel_stages(id),
  notes TEXT,
  created_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.prospect_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  alert_type public.prospect_alert_type NOT NULL,
  alert_date TIMESTAMP WITH TIME ZONE NOT NULL,
  relative_days INTEGER,
  notify_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_sent BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.employees(id),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.alert_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  inactivity_threshold_days INTEGER NOT NULL DEFAULT 7,
  default_notify_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_inactivity_alert_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT alert_settings_singleton CHECK (id = 1)
);

CREATE INDEX idx_contact_channels_active ON public.contact_channels(is_active);
CREATE INDEX idx_funnel_stages_order ON public.funnel_stages(stage_order);
CREATE INDEX idx_prospects_country_id ON public.prospects(country_id);
CREATE INDEX idx_prospects_current_stage_id ON public.prospects(current_stage_id);
CREATE INDEX idx_prospects_assigned_executive_id ON public.prospects(assigned_executive_id);
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_prospects_first_contact_date ON public.prospects(first_contact_date);
CREATE INDEX idx_prospects_last_interaction_at ON public.prospects(last_interaction_at);
CREATE INDEX idx_prospect_platforms_prospect_id ON public.prospect_platforms(prospect_id);
CREATE INDEX idx_prospect_platforms_platform_id ON public.prospect_platforms(platform_id);
CREATE INDEX idx_prospect_stage_history_prospect_id ON public.prospect_stage_history(prospect_id);
CREATE INDEX idx_prospect_stage_history_stage_id ON public.prospect_stage_history(stage_id);
CREATE INDEX idx_prospect_interactions_prospect_id ON public.prospect_interactions(prospect_id);
CREATE INDEX idx_prospect_interactions_date ON public.prospect_interactions(interaction_date);
CREATE INDEX idx_prospect_alerts_prospect_id ON public.prospect_alerts(prospect_id);
CREATE INDEX idx_prospect_alerts_alert_date ON public.prospect_alerts(alert_date);
CREATE INDEX idx_prospect_alerts_is_dismissed ON public.prospect_alerts(is_dismissed);

ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read contact_channels"
ON public.contact_channels
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin manage contact_channels"
ON public.contact_channels
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "auth read lost_reasons"
ON public.lost_reasons
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin manage lost_reasons"
ON public.lost_reasons
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "auth read funnel_stages"
ON public.funnel_stages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin manage funnel_stages"
ON public.funnel_stages
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin manage prospects"
ON public.prospects
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "exec read assigned prospects"
ON public.prospects
FOR SELECT
TO authenticated
USING (
  assigned_executive_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "exec insert own prospects"
ON public.prospects
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_executive_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
  AND created_by_employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "exec update assigned prospects"
ON public.prospects
FOR UPDATE
TO authenticated
USING (
  assigned_executive_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
)
WITH CHECK (
  assigned_executive_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "admin manage prospect_platforms"
ON public.prospect_platforms
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "exec manage own prospect_platforms"
ON public.prospect_platforms
FOR ALL
TO authenticated
USING (
  prospect_id IN (
    SELECT p.id
    FROM public.prospects p
    WHERE p.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  prospect_id IN (
    SELECT p.id
    FROM public.prospects p
    WHERE p.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
);

CREATE POLICY "admin manage prospect_stage_history"
ON public.prospect_stage_history
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "exec read own prospect_stage_history"
ON public.prospect_stage_history
FOR SELECT
TO authenticated
USING (
  prospect_id IN (
    SELECT p.id
    FROM public.prospects p
    WHERE p.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
);

CREATE POLICY "admin manage prospect_interactions"
ON public.prospect_interactions
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "exec manage own prospect_interactions"
ON public.prospect_interactions
FOR ALL
TO authenticated
USING (
  prospect_id IN (
    SELECT p.id
    FROM public.prospects p
    WHERE p.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  prospect_id IN (
    SELECT p.id
    FROM public.prospects p
    WHERE p.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
);

CREATE POLICY "admin manage prospect_alerts"
ON public.prospect_alerts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "exec manage own prospect_alerts"
ON public.prospect_alerts
FOR ALL
TO authenticated
USING (
  prospect_id IN (
    SELECT p.id
    FROM public.prospects p
    WHERE p.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  prospect_id IN (
    SELECT p.id
    FROM public.prospects p
    WHERE p.assigned_executive_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
  )
);

CREATE POLICY "auth read alert_settings"
ON public.alert_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin manage alert_settings"
ON public.alert_settings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

CREATE TRIGGER trg_alert_settings_updated_at
BEFORE UPDATE ON public.alert_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

INSERT INTO public.contact_channels (name, type, country_scope)
VALUES
  ('Instagram Mevak', 'social', NULL),
  ('Instagram Darío', 'social', NULL),
  ('TikTok Darío', 'social', NULL),
  ('TikTok Mevak', 'social', NULL),
  ('Sitio Web Growth', 'web', NULL),
  ('Sitio Web General', 'web', NULL),
  ('Cerrame la 8', 'event', NULL),
  ('Food Delivery Day', 'event', NULL),
  ('Mail', 'email', NULL),
  ('LinkedIn', 'professional', NULL)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.lost_reasons (reason)
VALUES
  ('Precio'),
  ('No interesado'),
  ('Sin respuesta'),
  ('Competencia'),
  ('Timing')
ON CONFLICT (reason) DO NOTHING;

INSERT INTO public.funnel_stages (name, stage_order, color)
VALUES
  ('Nuevo Contacto', 1, 'gray'),
  ('Contactado', 2, 'blue'),
  ('Interesado', 3, 'sky'),
  ('Demo / Reunión Agendada', 4, 'purple'),
  ('Propuesta Enviada', 5, 'orange'),
  ('Negociación', 6, 'yellow'),
  ('Cerrado Ganado', 7, 'green'),
  ('Cerrado Perdido', 8, 'red')
ON CONFLICT (name) DO UPDATE
SET stage_order = EXCLUDED.stage_order,
    color = EXCLUDED.color;

INSERT INTO public.alert_settings (id, inactivity_threshold_days, default_notify_emails, is_inactivity_alert_active)
VALUES (1, 7, ARRAY[]::TEXT[], true)
ON CONFLICT (id) DO NOTHING;