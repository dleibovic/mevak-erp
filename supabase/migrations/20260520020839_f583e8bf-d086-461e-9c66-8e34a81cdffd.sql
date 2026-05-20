ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS cac_default_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_margin_default_pct numeric NOT NULL DEFAULT 70;