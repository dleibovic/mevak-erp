# Project implementation rules

- Keep global light/dark visual roles in `src/index.css` and map them through Tailwind's semantic colors, so every screen inherits brand changes without modifying data logic.
- Use `next-themes` at the app root with a class on `<html>` for appearance preference, so the existing toast theme and all routes stay in sync.
- Use a manifest and static icons for home-screen installation without an app-shell service worker, so preview and returning visitors always receive fresh pages.
- Keep partner debt ledger presentation and repayment entry in the admin-only statistics current-account tab, so balances and their movement history share one access-controlled view.
- Read monthlyized client revenue from `v_client_metrics.current_mrr` instead of recomputing `monthly_fee × branches × frequency multiplier` in the UI, so weekly and per-branch clients are never double-counted.
- Treat "the current month" as a `[first day, first day of next month)` ISO range built by `monthBounds` in `src/lib/billingPeriod.ts`, so weekly billing periods (Mondays) are not missed.
- Keep the marketing mail sequence ("nurturing_guia") as pure templates/eligibility in `supabase/functions/_shared/nurturing.ts` and stage moves in `_shared/prospects.ts`, so ingest-lead, process-sequences and resend-webhook share one set of rules and can be unit-tested with Deno.
- Build every marketing/newsletter email with `layout()` and the `card`/`button`/`pill`/`signature` helpers in `supabase/functions/_shared/email-layout.ts`, so all Mevak mails share one approved template (tables + inline styles, `@media` only for `.pad`/`.stack`) and always ship a plain-text version.
- Load email images (logo, avatar) from `assetsBase()` (secret `EMAIL_ASSETS_BASE`, default the stable email-assets function), never from the marketing site, so a site DNS outage cannot break images; links still point to the site.
- Turn the sequence on/off only through the admin RPC `set_nurturing_enabled`, so enabling always stops stale backlog (>21 days) and staggers the rest 5 per hour; process-sequences also caps each hourly run at 5 sends.
- Send mail through `sendResend`/`resendFetch`: a native `re_` RESEND_API_KEY calls api.resend.com directly, anything else goes through the Lovable connector gateway. The reply-to comes only from the `EMAIL_REPLY_TO` secret (default `dario@mevak.com.ar`), so switching to the receiving subdomain is a single secret change.

## Resend webhook (resend-webhook)
- URL: `https://chswulyeiyeuiawgjxze.supabase.co/functions/v1/resend-webhook` (public, verify_jwt=false; authenticates by svix signature).
- Two Resend accounts: the **sending** account owns `mevak.com.ar` (subscribe `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`); the **receiving** account owns `r.mevak.com.ar` (subscribe `email.received`). A delivery is accepted if its signature validates with either webhook secret; the matching secret name is stored in `resend_webhook_events.verified_with`. If the secret expected for the event's account is missing, the function answers 500 "<NAME> not configured".
- Inbound bodies are fetched with the receiving account's key; without it the reply is still logged/forwarded from webhook metadata with a "No se pudo recuperar el cuerpo" note. Forwards to dario@mevak.com.ar always go out through the sending account, from dario@mevak.com.ar, reply_to = the prospect.
- Delivery ids are recorded in `resend_webhook_events` so Resend retries are not processed twice.

| Secret | Account | Used for |
|---|---|---|
| `RESEND_API_KEY` | Sending (mevak.com.ar) | Sequence mails, preview, forwarding replies to Darío |
| `RESEND_WEBHOOK_SECRET` | Sending | svix signing secret (`whsec_…`) of the tracking-events webhook |
| `RESEND_API_KEY_INBOUND` | Receiving (r.mevak.com.ar) | `GET /emails/receiving/{id}` to fetch reply bodies |
| `RESEND_WEBHOOK_SECRET_INBOUND` | Receiving | svix signing secret of the `email.received` webhook |
| `EMAIL_REPLY_TO` | — | Reply-to of sequence mails (default `dario@mevak.com.ar`; set to `Darío de Mevak <dario@r.mevak.com.ar>` once receiving is verified) |
