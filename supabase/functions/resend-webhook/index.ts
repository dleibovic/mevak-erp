import { createClient } from "npm:@supabase/supabase-js@2";
import { FORWARD_TO, resendFetch, sendResend } from "../_shared/nurturing.ts";
import { escapeIlike, loadStages, moveStageIfIn, stopActiveSequences } from "../_shared/prospects.ts";
import { forwardMessage, parseReceived, replySnippet, sendPatchFor, TRACKING_EVENTS, verifySvix } from "./lib.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const OWN_DOMAINS = /@(r\.)?mevak\.com\.ar$|@mevakfoodagency\.com$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return json({ error: "RESEND_WEBHOOK_SECRET not configured" }, 500);

  const raw = await req.text();
  const svixId = req.headers.get("svix-id");
  const ok = await verifySvix(secret, { id: svixId, timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, raw);
  if (!ok) return json({ error: "invalid_signature" }, 401);

  let event: any;
  try { event = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const type = String(event?.type ?? "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotency: Resend retries deliveries with the same svix-id.
  const { error: dupErr } = await sb.from("resend_webhook_events").insert({ svix_id: svixId, event_type: type });
  if (dupErr) return json({ status: "duplicate" });

  try {
    if (TRACKING_EVENTS.includes(type)) {
      const emailId = event?.data?.email_id;
      if (!emailId) return json({ status: "ignored" });
      const { data: send } = await sb.from("sequence_sends").select("*, seq:prospect_sequences(id, prospect_id)").eq("resend_email_id", emailId).maybeSingle();
      if (!send) return json({ status: "unknown_email" });
      const patch = sendPatchFor(type, event.created_at ?? new Date().toISOString(), send);
      if (patch && Object.keys(patch).length) await sb.from("sequence_sends").update(patch).eq("id", send.id);
      if (type === "email.bounced" || type === "email.complained") {
        const prospectId = (send as any).seq?.prospect_id;
        if (prospectId) {
          await stopActiveSequences(sb, prospectId, type === "email.bounced" ? "rebote" : "queja");
          await sb.from("prospects").update({ email_bounced: true }).eq("id", prospectId);
        }
      }
      return json({ status: "ok" });
    }

    if (type === "email.received") {
      const inb = parseReceived(event);
      if ((!inb.text && !inb.html) && inb.emailId) {
        const full: any = await resendFetch(`/emails/receiving/${inb.emailId}`).catch(() => null);
        if (full) { inb.text = full.text ?? null; inb.html = full.html ?? null; }
      }
      if (!inb.from || OWN_DOMAINS.test(inb.from)) return json({ status: "ignored_own" });

      const { data: matches } = await sb.from("prospects").select("id, business_name, email, current_stage_id").ilike("email", escapeIlike(inb.from)).limit(1);
      const p: any = matches?.[0] ?? null;
      if (p) {
        const now = new Date().toISOString();
        await sb.from("prospect_interactions").insert({ prospect_id: p.id, stage_at_interaction_id: p.current_stage_id, notes: `Respondió por mail: ${inb.subject} — ${replySnippet(inb.text, inb.html)}` });
        await stopActiveSequences(sb, p.id, "respondio", { replied_at: now });
        await sb.from("prospect_sequences").update({ replied_at: now }).eq("prospect_id", p.id).is("replied_at", null);
        await sb.from("prospects").update({ last_interaction_at: now }).eq("id", p.id);
        await moveStageIfIn(sb, await loadStages(sb), p, ["Nuevo Contacto", "Contactado"], "Interesado", "Etapa → Interesado (respondió el mail)");
      }
      const empresa = p && p.business_name && p.business_name !== p.email ? p.business_name : null;
      const fwd = forwardMessage(inb, empresa);
      const id = await sendResend({ to: FORWARD_TO, subject: fwd.subject, html: fwd.html, text: fwd.text, replyTo: inb.from });
      return json({ status: "ok", prospect_id: p?.id ?? null, forwarded_id: id });
    }

    return json({ status: "ignored" });
  } catch (e) {
    // Allow Resend to retry: forget this delivery id.
    await sb.from("resend_webhook_events").delete().eq("svix_id", svixId);
    console.error("resend-webhook failed", type, (e as Error).message);
    return json({ error: "processing_failed", details: (e as Error).message }, 500);
  }
});
