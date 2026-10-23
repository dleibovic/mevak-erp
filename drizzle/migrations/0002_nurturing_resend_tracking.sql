ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS lang text,
  ADD COLUMN IF NOT EXISTS food_category text,
  ADD COLUMN IF NOT EXISTS email_bounced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_requested_at timestamptz;

ALTER TABLE public.sequence_sends
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz;
CREATE INDEX IF NOT EXISTS sequence_sends_resend_id_idx ON public.sequence_sends (resend_email_id);

ALTER TABLE public.prospect_sequences ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- Backfill: existing unsubscribes and audit/booking origins.
UPDATE public.prospects p SET unsubscribed_at = s.updated_at
  FROM public.prospect_sequences s
  WHERE s.prospect_id = p.id AND s.stop_reason = 'baja' AND p.unsubscribed_at IS NULL;
UPDATE public.prospects SET audit_requested_at = created_at
  WHERE audit_requested_at IS NULL
    AND (lower(guide_downloaded) LIKE 'auditoria\_%' OR lower(guide_downloaded) IN ('lead_form','booking_call'));

-- Idempotency log for Resend webhooks (service role only).
CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
  svix_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.resend_webhook_events TO service_role;
ALTER TABLE public.resend_webhook_events ENABLE ROW LEVEL SECURITY;

-- Master switch: only admins; on first enable stops stale backlog and staggers the rest 5 per hour.
CREATE OR REPLACE FUNCTION public.set_nurturing_enabled(_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_was boolean; v_old int := 0; v_staggered int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT enabled INTO v_was FROM public.sequence_settings WHERE key = 'nurturing_guia_enabled' FOR UPDATE;
  UPDATE public.sequence_settings SET enabled = _enabled, updated_at = now() WHERE key = 'nurturing_guia_enabled';
  IF _enabled AND NOT coalesce(v_was, false) THEN
    WITH old AS (
      UPDATE public.prospect_sequences s SET status = 'stopped', stop_reason = 'antiguo', next_send_at = NULL
      FROM public.prospects p
      WHERE p.id = s.prospect_id AND s.status = 'active' AND s.sequence_key = 'nurturing_guia'
        AND p.created_at < now() - interval '21 days'
      RETURNING 1)
    SELECT count(*) INTO v_old FROM old;
    WITH due AS (
      SELECT s.id, (row_number() OVER (ORDER BY p.created_at DESC, s.id) - 1)::int AS rn
      FROM public.prospect_sequences s JOIN public.prospects p ON p.id = s.prospect_id
      WHERE s.status = 'active' AND s.sequence_key = 'nurturing_guia' AND s.next_send_at <= now()),
    upd AS (
      UPDATE public.prospect_sequences s SET next_send_at = now() + make_interval(hours => due.rn / 5)
      FROM due WHERE due.id = s.id RETURNING 1)
    SELECT count(*) INTO v_staggered FROM upd;
  END IF;
  RETURN jsonb_build_object('enabled', _enabled, 'stopped_old', v_old, 'staggered', v_staggered);
END $$;
REVOKE ALL ON FUNCTION public.set_nurturing_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_nurturing_enabled(boolean) TO authenticated;