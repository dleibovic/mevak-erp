CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_name_key UNIQUE (name)
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read payment_methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin manage payment_methods"
ON public.payment_methods
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

ALTER TABLE public.clients
ADD COLUMN payment_method_id UUID;

ALTER TABLE public.clients
ADD CONSTRAINT clients_payment_method_id_fkey
FOREIGN KEY (payment_method_id)
REFERENCES public.payment_methods(id);

CREATE INDEX idx_clients_payment_method_id
ON public.clients(payment_method_id);

INSERT INTO public.payment_methods (name)
VALUES
  ('Stripe'),
  ('Depósito Bancario'),
  ('Efectivo'),
  ('Otro')
ON CONFLICT (name) DO NOTHING;