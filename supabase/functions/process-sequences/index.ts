import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { NEXT_DELAY_DAYS, renderStep, sendResend, signProspect } from "../_shared/nurturing.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function unsubUrl(prospectId: string) {
  const s = await signProspect(prospectId, Deno.env.get("UNSUBSCRIBE_SECRET") ?? "");
  return `${URL_BASE}/functions/v1/email-unsubscribe?p=${prospectId}&s=${s}`;
}

async function isPrivileged(req: Request, sb: any) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === SERVICE) return true;
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return false;
  const { data: admin } = await sb.rpc("is_admin", { _user_id: data.user.id });
  return !!admin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(URL_BASE, SERVICE);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  // Preview: sends the 3 templates with sample data, never touches sequences.
  if (body?.preview_to) {
    if (!(await isPrivileged(req, sb))) return json({ error: "unauthorized" }, 401);
    const to = String(body.preview_to).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 255) return json({ error: "invalid_email" }, 400);
    const results = [];
    for (const step of [1, 2, 3] as const) {
      const u = `${URL_BASE}/functions/v1/email-unsubscribe?preview=1`;
      const { subject, html } = renderStep(step, "Juan", "La Parrilla de Juan", u);
      try { results.push({ step, id: await sendResend(to, `[PREVIEW] ${subject}`, html, u) }); }
      catch (e) { results.push({ step, error: String((e as Error).message) }); }
    }
    return json({ preview: true, results });
  }

  const { data: setting } = await sb.from("sequence_settings").select("enabled").eq("key", "nurturing_guia_enabled").maybeSingle();
  if (!setting?.enabled) return json({ status: "disabled" });

  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb.from("prospect_sequences")
    .select("id, current_step, prospect:prospects!inner(id, email, contact_name, business_name, marketing_opt_in, current_stage_id)")
    .eq("status", "active").eq("sequence_key", "nurturing_guia").lte("next_send_at", nowIso)
    .eq("prospect.marketing_opt_in", true).limit(100);
  if (error) return json({ error: error.message }, 500);

  let sent = 0; const errors: unknown[] = [];
  for (const seq of due ?? []) {
    const p: any = seq.prospect;
    const step = (seq.current_step + 1) as 1 | 2 | 3;
    if (step > 3 || !p?.email) { await sb.from("prospect_sequences").update({ status: "completed" }).eq("id", seq.id); continue; }
    // Claim the row so a concurrent run cannot send twice.
    const { data: claimed } = await sb.from("prospect_sequences").update({ next_send_at: null })
      .eq("id", seq.id).eq("status", "active").eq("current_step", seq.current_step).lte("next_send_at", nowIso).select("id");
    if (!claimed?.length) continue;
    const u = await unsubUrl(p.id);
    const { subject, html } = renderStep(step, p.contact_name ?? "", p.business_name && p.business_name !== p.email ? p.business_name : "", u);
    try {
      const resendId = await sendResend(p.email, subject, html, u);
      const now = new Date();
      const delay = NEXT_DELAY_DAYS[step];
      await sb.from("sequence_sends").insert({ prospect_sequence_id: seq.id, step, subject, resend_email_id: resendId, sent_at: now.toISOString() });
      await sb.from("prospect_sequences").update(delay
        ? { current_step: step, next_send_at: new Date(now.getTime() + delay * 86400000).toISOString() }
        : { current_step: step, status: "completed", next_send_at: null }).eq("id", seq.id);
      await sb.from("prospect_interactions").insert({ prospect_id: p.id, stage_at_interaction_id: p.current_stage_id, notes: `Mail ${step} de secuencia enviado: ${subject}` });
      await sb.from("prospects").update({ last_interaction_at: now.toISOString() }).eq("id", p.id);
      sent++;
    } catch (e) {
      // Release the claim; retry next hour.
      await sb.from("prospect_sequences").update({ next_send_at: nowIso }).eq("id", seq.id);
      errors.push({ id: seq.id, error: String((e as Error).message) });
    }
  }
  return json({ status: "ok", due: due?.length ?? 0, sent, errors });
});
