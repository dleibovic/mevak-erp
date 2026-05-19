// Recomputes MRR snapshots for a given period (default: current month).
// Also runs auto-churn for paused clients past threshold.
// Scheduled via pg_cron daily.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const periodParam = url.searchParams.get("period"); // YYYY-MM-01
  const backfillMonths = url.searchParams.get("backfill");

  try {
    let result: any = {};

    if (backfillMonths) {
      const months = Math.min(60, Math.max(1, parseInt(backfillMonths, 10) || 24));
      const { data, error } = await supabase.rpc("backfill_mrr_snapshots", { _months: months });
      if (error) throw error;
      result.backfilled_months = data;
    } else {
      const now = new Date();
      const period =
        periodParam ||
        `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const { error } = await supabase.rpc("recompute_mrr_for_month", { _period: period });
      if (error) throw error;
      result.recomputed_period = period;
    }

    // Run auto-churn (paused -> churned past threshold)
    const { data: churned, error: churnErr } = await supabase.rpc("auto_churn_paused_clients");
    if (!churnErr) result.auto_churned = churned;

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
