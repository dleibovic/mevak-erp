# Project implementation rules

- Keep global light/dark visual roles in `src/index.css` and map them through Tailwind's semantic colors, so every screen inherits brand changes without modifying data logic.
- Use `next-themes` at the app root with a class on `<html>` for appearance preference, so the existing toast theme and all routes stay in sync.
- Use a manifest and static icons for home-screen installation without an app-shell service worker, so preview and returning visitors always receive fresh pages.
- Keep partner debt ledger presentation and repayment entry in the admin-only statistics current-account tab, so balances and their movement history share one access-controlled view.
- Read monthlyized client revenue from `v_client_metrics.current_mrr` instead of recomputing `monthly_fee × branches × frequency multiplier` in the UI, so weekly and per-branch clients are never double-counted.
- Treat "the current month" as a `[first day, first day of next month)` ISO range built by `monthBounds` in `src/lib/billingPeriod.ts`, so weekly billing periods (Mondays) are not missed.
- Keep the marketing mail sequence ("nurturing_guia") as pure templates/eligibility in `supabase/functions/_shared/nurturing.ts` and stage moves in `_shared/prospects.ts`, so ingest-lead, process-sequences and resend-webhook share one set of rules and can be unit-tested with Deno.
- Turn the sequence on/off only through the admin RPC `set_nurturing_enabled`, so enabling always stops stale backlog (>21 days) and staggers the rest 5 per hour; process-sequences also caps each hourly run at 5 sends.
- Send mail through `sendResend`/`resendFetch`: a native `re_` RESEND_API_KEY calls api.resend.com directly, anything else goes through the Lovable connector gateway. The reply-to comes only from the `EMAIL_REPLY_TO` secret (default `dario@mevak.com.ar`), so switching to the receiving subdomain is a single secret change.

## Resend webhook (resend-webhook)
- URL: `https://chswulyeiyeuiawgjxze.supabase.co/functions/v1/resend-webhook` (public, verify_jwt=false; authenticates by svix signature).
- Subscribe in Resend: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.received`.
- Secret `RESEND_WEBHOOK_SECRET` = the webhook "Signing secret" (`whsec_…`) shown by Resend. Without it the function answers 500 by design.
- Receiving domain: `r.mevak.com.ar` (MX in Resend). Once verified, set secret `EMAIL_REPLY_TO` = `Darío de Mevak <dario@r.mevak.com.ar>`; replies are logged on the prospect, stop the sequence (`respondio`) and are forwarded to dario@mevak.com.ar with reply_to = the prospect.
- Delivery ids are recorded in `resend_webhook_events` so Resend retries are not processed twice.
