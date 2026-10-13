CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.prospect_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  sequence_key text NOT NULL DEFAULT 'nurturing_guia',
  current_step int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped')),
  stop_reason text,
  next_send_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, sequence_key)
);
CREATE INDEX prospect_sequences_due_idx ON public.prospect_sequences (status, next_send_at);
GRANT SELECT, UPDATE ON public.prospect_sequences TO authenticated;
GRANT ALL ON public.prospect_sequences TO service_role;
ALTER TABLE public.prospect_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sequences of visible prospects" ON public.prospect_sequences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id));
CREATE POLICY "update sequences of editable prospects" ON public.prospect_sequences FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.prospects p JOIN public.employees e ON e.id = p.assigned_executive_id WHERE p.id = prospect_id AND e.user_id = auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.prospects p JOIN public.employees e ON e.id = p.assigned_executive_id WHERE p.id = prospect_id AND e.user_id = auth.uid()));
CREATE TRIGGER prospect_sequences_updated_at BEFORE UPDATE ON public.prospect_sequences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sequence_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_sequence_id uuid NOT NULL REFERENCES public.prospect_sequences(id) ON DELETE CASCADE,
  step int NOT NULL,
  subject text,
  resend_email_id text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sequence_sends TO authenticated;
GRANT ALL ON public.sequence_sends TO service_role;
ALTER TABLE public.sequence_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sends of visible sequences" ON public.sequence_sends FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospect_sequences s WHERE s.id = prospect_sequence_id));

CREATE TABLE public.sequence_settings (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.sequence_settings TO authenticated;
GRANT ALL ON public.sequence_settings TO service_role;
ALTER TABLE public.sequence_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sequence settings" ON public.sequence_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin update sequence settings" ON public.sequence_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.sequence_settings (key, enabled) VALUES ('nurturing_guia_enabled', false);

INSERT INTO public.prospect_sequences (prospect_id, next_send_at)
SELECT p.id, now() + interval '24 hours' FROM public.prospects p
WHERE p.status = 'active' AND p.marketing_opt_in = true
ON CONFLICT (prospect_id, sequence_key) DO NOTHING;