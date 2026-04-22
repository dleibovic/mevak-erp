ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id);
CREATE INDEX IF NOT EXISTS idx_expenses_country ON public.expenses(country_id);