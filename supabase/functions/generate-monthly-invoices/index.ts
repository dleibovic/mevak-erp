import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let period: string | null = null;
    if (req.method === "POST") {
      try { const body = await req.json(); period = body?.period ?? null; } catch (_) { /* ignore */ }
    }
    const { data, error } = await supabase.rpc(
      "generate_monthly_invoices",
      period ? { _period: period } : {},
    );
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, inserted: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
