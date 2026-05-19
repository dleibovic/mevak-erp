// Weekly exchange rate health check: detects missing recent pulls and >20% MoM swings.
// Notifies via in-app notifications (admins) and logs to console.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const issues: { currency: string; severity: "warn" | "error"; message: string }[] = [];
  const MAJORS = ["ARS", "EUR", "BRL", "MXN", "COP", "CLP", "PEN", "UYU"];

  // 1. Most recent rate per major currency must be within last 8 days
  const now = new Date();
  const cutoff = new Date(now.getTime() - 8 * 86400 * 1000).toISOString().slice(0, 10);
  for (const cur of MAJORS) {
    const { data: latest } = await supabase
      .from("exchange_rates")
      .select("rate, rate_date")
      .eq("base_currency", cur).eq("quote_currency", "USD")
      .order("rate_date", { ascending: false }).limit(2);
    if (!latest?.length) {
      issues.push({ currency: cur, severity: "warn", message: `Sin rate registrado para ${cur}` });
      continue;
    }
    if (latest[0].rate_date < cutoff) {
      issues.push({ currency: cur, severity: "error", message: `Último rate de ${cur} es ${latest[0].rate_date} (>8 días)` });
    }
    if (latest.length === 2) {
      const a = Number(latest[0].rate), b = Number(latest[1].rate);
      if (b > 0) {
        const pct = Math.abs((a - b) / b) * 100;
        if (pct > 20) {
          issues.push({ currency: cur, severity: "warn", message: `${cur}: variación ${pct.toFixed(1)}% entre ${latest[1].rate_date} y ${latest[0].rate_date}` });
        }
      }
    }
  }

  console.log("[exchange-rate-health-check]", JSON.stringify({ issues, checked_at: now.toISOString() }));

  if (issues.length) {
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (admins?.length) {
      const body = issues.map((i) => `[${i.severity.toUpperCase()}] ${i.message}`).join("\n");
      const rows = admins.map((a) => ({
        user_id: a.user_id,
        title: `Alerta tipos de cambio: ${issues.length} hallazgo${issues.length === 1 ? "" : "s"}`,
        body,
        link: "/admin",
      }));
      await supabase.from("notifications").insert(rows);
    }
  }

  return new Response(JSON.stringify({ issues, count: issues.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
