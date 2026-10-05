# Project implementation rules

- Keep global light/dark visual roles in `src/index.css` and map them through Tailwind's semantic colors, so every screen inherits brand changes without modifying data logic.
- Use `next-themes` at the app root with a class on `<html>` for appearance preference, so the existing toast theme and all routes stay in sync.
- Use a manifest and static icons for home-screen installation without an app-shell service worker, so preview and returning visitors always receive fresh pages.
- Keep partner debt ledger presentation and repayment entry in the admin-only statistics current-account tab, so balances and their movement history share one access-controlled view.
- Read monthlyized client revenue from `v_client_metrics.current_mrr` instead of recomputing `monthly_fee × branches × frequency multiplier` in the UI, so weekly and per-branch clients are never double-counted.
- Treat "the current month" as a `[first day, first day of next month)` ISO range built by `monthBounds` in `src/lib/billingPeriod.ts`, so weekly billing periods (Mondays) are not missed.