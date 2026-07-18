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

  const expected = Deno.env.get("CRON_SHARED_SECRET");
  const provided = req.headers.get("x-shared-secret") ?? "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
  // open.er-api.com: free, no key, returns USD-base rates for all currencies (latest only)
  let usdRates: Record<string, number> | null = null;
  try {
    const apiUrl = `https://open.er-api.com/v6/latest/USD`;
    const res = await fetch(apiUrl);
    const json = await res.json();
    if (json?.result === "success" && json?.rates) {
      usdRates = json.rates as Record<string, number>;
    } else {
      results.push({ ok: false, error: "open.er-api.com error", raw: json });
    }
  } catch (e) {
    results.push({ ok: false, error: String(e) });
  }

  if (usdRates) {
    for (const cur of CURRENCIES) {
      const usdToCur = usdRates[cur];
      if (!usdToCur) {
        results.push({ currency: cur, ok: false, error: `no rate for ${cur}` });
        continue;
      }
      // Canonical format: units of local currency per 1 USD (natural human format).
      const rate = usdToCur;
      const { error } = await supabase
        .from("exchange_rates")
        .upsert(
          {
            base_currency: cur,
            quote_currency: "USD",
            rate_date: rateDate,
            rate,
            source: "api",
            notes: "open.er-api.com (canonical: local per USD)",
          },
          { onConflict: "base_currency,quote_currency,rate_date" },
        );
      if (error) {
        results.push({ currency: cur, ok: false, error: error.message });
      } else {
        results.push({ currency: cur, ok: true, rate, rate_date: rateDate });
      }
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
