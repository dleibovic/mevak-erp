ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS guide_downloaded text,
  ADD COLUMN IF NOT EXISTS locations_range text,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_lead_id text;
CREATE UNIQUE INDEX IF NOT EXISTS prospects_external_lead_id_key ON public.prospects(external_lead_id);
CREATE INDEX IF NOT EXISTS prospects_email_lower_idx ON public.prospects(lower(email));