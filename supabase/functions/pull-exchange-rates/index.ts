// Pulls monthly exchange rates -> USD from exchangerate.host (no key required).
// Stores the rate for the last day of the previous month.
// Scheduled via pg_cron: day 1 at 00:05 UTC.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CURRENCIES = ["ARS", "EUR"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);

  // Allow ?date=YYYY-MM-DD override; default = last day of previous month
  const overrideDate = url.searchParams.get("date");
  let rateDate: string;
  if (overrideDate) {
    rateDate = overrideDate;
  } else {
    const now = new Date();
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastPrevMonth = new Date(firstOfMonth.getTime() - 86400000);
    rateDate = lastPrevMonth.toISOString().slice(0, 10);
  }

  const results: any[] = [];
  for (const cur of CURRENCIES) {
    try {
      // exchangerate.host: convert X currency -> USD
      const apiUrl = `https://api.exchangerate.host/convert?from=${cur}&to=USD&date=${rateDate}`;
      const res = await fetch(apiUrl);
      const json = await res.json();
      const rate = json?.result ?? json?.info?.rate;
      if (!rate || typeof rate !== "number") {
        results.push({ currency: cur, ok: false, error: "no rate", raw: json });
        continue;
      }
      const { error } = await supabase
        .from("exchange_rates")
        .upsert(
          {
            base_currency: cur,
            quote_currency: "USD",
            rate_date: rateDate,
            rate,
            source: "api",
            notes: "exchangerate.host",
          },
          { onConflict: "base_currency,quote_currency,rate_date" },
        );
      if (error) {
        results.push({ currency: cur, ok: false, error: error.message });
      } else {
        results.push({ currency: cur, ok: true, rate, rate_date: rateDate });
      }
    } catch (e) {
      results.push({ currency: cur, ok: false, error: String(e) });
    }
  }

  // After pulling, recompute current month's MRR so the dashboard reflects new rates
  try {
    const period = new Date();
    const periodStr = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-01`;
    await supabase.rpc("recompute_mrr_for_month", { _period: periodStr });
  } catch (_) {}

  return new Response(JSON.stringify({ ok: true, rate_date: rateDate, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
