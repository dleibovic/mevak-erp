// Pure helpers for the Resend webhook: svix signature, event → sequence_sends patch, inbound parsing.

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function svixSign(secret: string, id: string, timestamp: string, body: string) {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey("raw", b64ToBytes(raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToB64(new Uint8Array(sig));
}

/** Verifies svix headers (svix-id, svix-timestamp, svix-signature "v1,<b64> v1,<b64>") within a 5-minute tolerance. */
export async function verifySvix(secret: string, h: { id: string | null; timestamp: string | null; signature: string | null }, body: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300) {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  let expected: string;
  try { expected = await svixSign(secret, h.id, h.timestamp, body); } catch { return false; }
  return h.signature.split(" ").some((part) => {
    const [v, sig] = part.split(",");
    return v === "v1" && !!sig && safeEqual(sig, expected);
  });
}

const RANK: Record<string, number> = { sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 9, complained: 9 };
const EVENT_MAP: Record<string, { status: string; field: string }> = {
  "email.delivered": { status: "delivered", field: "delivered_at" },
  "email.opened": { status: "opened", field: "opened_at" },
  "email.clicked": { status: "clicked", field: "clicked_at" },
  "email.bounced": { status: "bounced", field: "bounced_at" },
  "email.complained": { status: "complained", field: "complained_at" },
};
export const TRACKING_EVENTS = Object.keys(EVENT_MAP);

/** Patch for a sequence_sends row; the first timestamp wins and status never regresses (clicked > opened > delivered). */
export function sendPatchFor(type: string, at: string, current: Record<string, any>) {
  const m = EVENT_MAP[type];
  if (!m) return null;
  const patch: Record<string, unknown> = {};
  if (!current[m.field]) patch[m.field] = at;
  if ((RANK[m.status] ?? 0) > (RANK[current.status ?? "sent"] ?? 0)) patch.status = m.status;
  return patch;
}

export function bareEmail(s?: string | null) {
  const v = (s ?? "").trim();
  const m = v.match(/<([^>]+)>/);
  return (m ? m[1] : v).trim().toLowerCase();
}

export type Inbound = { emailId: string | null; from: string; to: string[]; subject: string; text: string | null; html: string | null };
export function parseReceived(event: any): Inbound {
  const d = event?.data ?? {};
  const to = Array.isArray(d.to) ? d.to : d.to ? [d.to] : [];
  return {
    emailId: d.email_id ?? d.id ?? null,
    from: bareEmail(d.from),
    to: to.map((x: string) => bareEmail(x)),
    subject: String(d.subject ?? "").trim() || "(sin asunto)",
    text: typeof d.text === "string" ? d.text : null,
    html: typeof d.html === "string" ? d.html : null,
  };
}

/** Plain-text excerpt of a reply, dropping quoted history ("El … escribió:", "On … wrote:", "> …"). */
export function replySnippet(text: string | null, html: string | null, max = 300) {
  let t = text ?? (html ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const cut = t.search(/\n\s*(El .{0,200}escribió:|On .{0,200}wrote:|-{2,}\s*Original Message|De: )/i);
  if (cut > 0) t = t.slice(0, cut);
  t = t.split("\n").filter((l) => !l.trim().startsWith(">")).join(" ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function forwardMessage(inb: Inbound, empresa: string | null) {
  const who = empresa || inb.from;
  const subject = `Re: ${inb.subject.replace(/^(re|rv|fw|fwd):\s*/i, "")} — respuesta de ${who}`;
  const header = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#6B6775;border-bottom:1px solid #E4E1D8;padding-bottom:8px;margin-bottom:12px">Respuesta de <strong>${escHtml(inb.from)}</strong>${empresa ? ` (${escHtml(empresa)})` : ""} a la secuencia de mails. Respondé este mail para contestarle directo.</div>`;
  const html = header + (inb.html ?? `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escHtml(inb.text ?? "")}</pre>`);
  const text = `Respuesta de ${inb.from}${empresa ? ` (${empresa})` : ""}:\n\n${inb.text ?? replySnippet(null, inb.html, 100000)}`;
  return { subject, html, text };
}
