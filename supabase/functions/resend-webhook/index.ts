import { createClient } from "npm:@supabase/supabase-js@2";
import { FORWARD_TO, FROM, resendFetch, sendResend } from "../_shared/nurturing.ts";
import { escapeIlike, loadStages, moveStageIfIn, stopActiveSequences } from "../_shared/prospects.ts";
import { forwardMessage, INBOUND_SECRET, MISSING_INBOUND_KEY_NOTE, parseReceived, replySnippet, resolveWebhookAuth, SEND_SECRET, sendPatchFor, TRACKING_EVENTS } from "./lib.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const OWN_DOMAINS = /@(r\.)?mevak\.com\.ar$|@mevakfoodagency\.com$/i;
const INBOUND_API_KEY = "RESEND_API_KEY_INBOUND";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  let claimedType = "";
  try { claimedType = String(JSON.parse(raw)?.type ?? ""); } catch { /* checked after signature */ }

  // Two Resend accounts: sending (tracking events) and receiving (email.received). Either signature is accepted.
  const svixId = req.headers.get("svix-id");
  const auth = await resolveWebhookAuth(
    { [SEND_SECRET]: Deno.env.get(SEND_SECRET), [INBOUND_SECRET]: Deno.env.get(INBOUND_SECRET) },
    { id: svixId, timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") },
    raw,
    claimedType,
  );
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  let event: any;
  try { event = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const type = String(event?.type ?? "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotency: Resend retries deliveries with the same svix-id.
  const { error: dupErr } = await sb.from("resend_webhook_events").insert({ svix_id: svixId, event_type: type, verified_with: auth.secret });
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
      let bodyNote: string | null = null;
      if ((!inb.text && !inb.html) && inb.emailId) {
        // The body lives in the receiving account, so it is fetched with that account's API key.
        if (!Deno.env.get(INBOUND_API_KEY)) {
          console.warn(`resend-webhook: ${INBOUND_API_KEY} missing; forwarding ${inb.emailId} without body`);
          bodyNote = MISSING_INBOUND_KEY_NOTE;
        } else {
          try {
            const full: any = await resendFetch(`/emails/receiving/${inb.emailId}`, {}, INBOUND_API_KEY);
            inb.text = full?.text ?? null; inb.html = full?.html ?? null;
          } catch (e) {
            console.error("resend-webhook: inbound body fetch failed", inb.emailId, (e as Error).message);
            bodyNote = `No se pudo recuperar el cuerpo: ${(e as Error).message.slice(0, 200)}`;
          }
        }
      }
      if (!inb.from || OWN_DOMAINS.test(inb.from)) return json({ status: "ignored_own" });

      const { data: matches } = await sb.from("prospects").select("id, business_name, email, current_stage_id").ilike("email", escapeIlike(inb.from)).limit(1);
      const p: any = matches?.[0] ?? null;
      if (p) {
        const now = new Date().toISOString();
        const snippet = replySnippet(inb.text, inb.html) || "(sin cuerpo)";
        await sb.from("prospect_interactions").insert({ prospect_id: p.id, stage_at_interaction_id: p.current_stage_id, notes: `Respondió por mail: ${inb.subject} — ${snippet}` });
        await stopActiveSequences(sb, p.id, "respondio", { replied_at: now });
        await sb.from("prospect_sequences").update({ replied_at: now }).eq("prospect_id", p.id).is("replied_at", null);
        await sb.from("prospects").update({ last_interaction_at: now }).eq("id", p.id);
        await moveStageIfIn(sb, await loadStages(sb), p, ["Nuevo Contacto", "Contactado"], "Interesado", "Etapa → Interesado (respondió el mail)");
      }
      const empresa = p && p.business_name && p.business_name !== p.email ? p.business_name : null;
      const fwd = forwardMessage(inb, empresa, bodyNote);
      // Forward goes out from the sending account (RESEND_API_KEY), from dario@mevak.com.ar, reply_to = prospect.
      const id = await sendResend({ to: FORWARD_TO, from: FROM, subject: fwd.subject, html: fwd.html, text: fwd.text, replyTo: inb.from });
      return json({ status: "ok", prospect_id: p?.id ?? null, forwarded_id: id, body_missing: !!bodyNote });
    }

    return json({ status: "ignored" });
  } catch (e) {
    // Allow Resend to retry: forget this delivery id.
    await sb.from("resend_webhook_events").delete().eq("svix_id", svixId);
    console.error("resend-webhook failed", type, (e as Error).message);
    return json({ error: "processing_failed", details: (e as Error).message }, 500);
  }
});
