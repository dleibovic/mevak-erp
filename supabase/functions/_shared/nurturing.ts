// Nurturing sequence "nurturing_guia": templates (ES/EN), eligibility rules and Resend sending.
// Pure helpers: no Deno globals at import time so they can be unit-tested anywhere.

export const FROM = "Darío de Mevak <dario@mevak.com.ar>";
export const FORWARD_TO = "dario@mevak.com.ar";
const DEFAULT_REPLY_TO = "Darío de Mevak <dario@mevak.com.ar>";
const UNSUB_MAILTO = "dario@mevak.com.ar";

const env = (k: string): string | undefined => (globalThis as any).Deno?.env?.get?.(k) ?? undefined;
/** Single place to change the reply-to (set EMAIL_REPLY_TO, e.g. "Darío de Mevak <dario@r.mevak.com.ar>"). */
export const replyTo = () => (env("EMAIL_REPLY_TO") || DEFAULT_REPLY_TO).trim();

export type Lang = "es" | "en";
export type Step = 1 | 2 | 3;

const EN_COUNTRIES = new Set(["US", "CA", "GB"]);
/** EN for US/CA/GB; if the country is unknown/other, an explicit lang=en from the site is honoured. */
export function pickLang(iso2?: string | null, lang?: string | null): Lang {
  if (iso2 && EN_COUNTRIES.has(iso2.toUpperCase())) return "en";
  if (!iso2 && (lang ?? "").toLowerCase().startsWith("en")) return "en";
  return "es";
}

const GUIDES: Record<string, { es: string; en: string }> = {
  guia_6_tacticas: { es: "6 Tácticas para rentabilizar tu delivery", en: "6 Tactics to make your delivery profitable" },
  guia_sorteo: { es: "El sorteo que no es un sorteo", en: "The giveaway that isn't a giveaway" },
  guia_vara_digital: { es: "15,7%: la vara real de tu canal digital", en: "15.7%: the real benchmark for your digital channel" },
  guia_evidencia: { es: "Cómo disputar un reclamo", en: "How to dispute a claim" },
  guia_pedido_chat: { es: "El pedido se muda al chat", en: "The order moves to chat" },
  guia_ticket_margen: { es: "Ticket y margen en delivery", en: "Ticket and margin in delivery" },
  geo_guide: { es: "la guía de GEO", en: "the GEO guide" },
  guia_ia_invisible: { es: "La IA invisible", en: "Invisible AI" },
  guia_restaurante_chat: { es: "Tu restaurante en el chat", en: "Your restaurant in the chat" },
  lead_magnet: { es: "el Scorecard de rentabilidad", en: "the Profitability Scorecard" },
  biblioteca_guias: { es: "las guías de Mevak", en: "Mevak's guides" },
};
const DEFAULT_GUIDE = { es: "nuestra guía", en: "our guide" };

/** Human guide name. Titles are quoted; generic phrases ("la guía de GEO") are not. */
export function guideName(key: string | null | undefined, lang: Lang = "es"): string {
  const g = GUIDES[(key ?? "").trim().toLowerCase()] ?? DEFAULT_GUIDE;
  const name = g[lang];
  return /^[A-Z0-9]/.test(name) ? `“${name}”` : name;
}
/** "de" + guide, contracting "de el" → "del". */
const deGuide = (g: string) => (g.startsWith("el ") ? `del ${g.slice(3)}` : `de ${g}`);

export function isAuditOrigin(origin?: string | null) {
  const o = (origin ?? "").trim().toLowerCase();
  return o.startsWith("auditoria_") || o === "lead_form" || o === "booking_call";
}

const TLD_TYPOS = new Set(["con", "cmo", "comm", "coom", "vom", "xom", "cpm"]);
const DOMAIN_TYPOS = new Set(["gmial.com", "gmai.com", "gmal.com", "gamil.com", "hotmial.com", "hotmal.com", "hotmai.com"]);
export function isValidEmail(email?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  if (e.length > 255 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) return false;
  const domain = e.split("@")[1];
  if (DOMAIN_TYPOS.has(domain)) return false;
  return !TLD_TYPOS.has(domain.split(".").pop()!);
}

export type EligibilityInput = {
  email: string | null;
  marketing_opt_in: boolean | null;
  unsubscribed_at: string | null;
  email_bounced: boolean | null;
  audit_requested_at: string | null;
  guide_downloaded: string | null;
  status: string | null; // prospects.status
  stage_order: number | null;
  stage_name: string | null;
};
export type Eligibility = { ok: true } | { ok: false; reason: "baja" | "rebote" | "email_invalido" | "pidio_auditoria" | "avanzo_etapa" };

export function evaluateEligibility(p: EligibilityInput): Eligibility {
  if (p.unsubscribed_at || !p.marketing_opt_in) return { ok: false, reason: "baja" };
  if (p.email_bounced) return { ok: false, reason: "rebote" };
  if (!isValidEmail(p.email)) return { ok: false, reason: "email_invalido" };
  if (p.audit_requested_at || isAuditOrigin(p.guide_downloaded)) return { ok: false, reason: "pidio_auditoria" };
  if ((p.status && p.status !== "active") || (p.stage_order ?? 1) >= 3 || /^cerrado/i.test(p.stage_name ?? "")) return { ok: false, reason: "avanzo_etapa" };
  return { ok: true };
}

export const NEXT_DELAY_DAYS: Record<number, number | null> = { 1: 3, 2: 4, 3: null };

// ---------- Templates ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const auditUrl = (n: Step) => `https://www.mevakfoodagency.com/?audit=1&utm_source=email&utm_medium=nurture&utm_campaign=sec_guia&utm_content=mail${n}`;
export const calendlyUrl = (n: Step) => `https://calendly.com/dario-mevak/delivery-y-rentabilidad-30-minutos?utm_source=email&utm_medium=nurture&utm_content=mail${n}`;
const INSTAGRAM = "https://www.instagram.com/mevakfoodagency";
const BRAND = "#555EC3";

type Block = { p: string } | { cta: true };

function htmlToText(h: string) {
  return h
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, "$2 ($1)")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function build(blocks: Block[], step: Step, lang: Lang, unsubUrl: string) {
  const L = lang === "en"
    ? { cta: "Request the free audit", alt: "or book 30 min with me", foot: "You're receiving this because you downloaded a Mevak guide.", unsub: "Unsubscribe" }
    : { cta: "Pedir la auditoría gratis", alt: "o agendá 30 min conmigo", foot: "Recibís este mail porque descargaste una guía de Mevak.", unsub: "No quiero recibir más estos mails" };
  const sig = "Darío Leibovic y María Dean · Mevak Food Agency";
  const htmlBody = blocks.map((b) => "cta" in b
    ? `<p style="margin:24px 0 8px"><a href="${auditUrl(step)}" style="background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block;font-weight:600">${L.cta}</a></p><p style="margin:0 0 16px;font-size:14px"><a href="${calendlyUrl(step)}" style="color:${BRAND}">${L.alt}</a></p>`
    : `<p style="margin:0 0 16px">${b.p}</p>`).join("\n");
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#F4F2EC;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2B2833">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;font-size:16px;line-height:1.6">
${htmlBody}
<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #E4E1D8;color:#6B6775;font-size:13px">${sig}</p>
</div>
<p style="max-width:600px;margin:16px auto 0;text-align:center;font-size:12px;color:#6B6775">${L.foot} <a href="${unsubUrl}" style="color:#6B6775">${L.unsub}</a></p>
</body></html>`;
  const text = [
    ...blocks.map((b) => "cta" in b ? `${L.cta}: ${auditUrl(step)}\n${L.alt}: ${calendlyUrl(step)}` : htmlToText(b.p)),
    "—",
    sig,
    `${L.foot} ${L.unsub}: ${unsubUrl}`,
  ].join("\n\n");
  return { html, text };
}

export type RenderInput = { nombre?: string | null; empresa?: string | null; guideKey?: string | null; lang?: Lang };

export function renderStep(step: Step, input: RenderInput, unsubUrl: string) {
  const lang: Lang = input.lang ?? "es";
  const rawName = (input.nombre ?? "").trim();
  const n = esc(rawName);
  const emp = esc((input.empresa ?? "").trim() || (lang === "en" ? "your business" : "tu negocio"));
  const guideRaw = guideName(input.guideKey, lang);
  const g = esc(guideRaw);
  let subject: string; let blocks: Block[];

  if (lang === "en") {
    const hi = n ? `Hi ${n}` : "Hi";
    if (step === 1) {
      subject = `Did you get to apply anything from ${guideRaw}${rawName ? ", " + rawName : ""}?`;
      blocks = [
        { p: `${hi}, Darío from Mevak here. I'm writing because you downloaded ${g}.` },
        { p: `Quick question: <strong>did you get to put any of it into practice?</strong>` },
        { p: `I ask because it's always the same story: you read the guide, spot two or three leaks (commissions, menu, numbers nobody looks at)… and then day-to-day operations take over.` },
        { p: `If you tell me how delivery is going at ${emp}, I'll reply personally with the one thing that moves the most margin in your case. No fluff.` },
        { p: `And if you'd rather look at it with your own numbers, request the free audit:` },
        { cta: true },
        { p: `Best,<br>Darío` },
      ];
    } else if (step === 2) {
      subject = "+288% revenue in six months (here's how)";
      blocks = [
        { p: `${hi}, following up on ${g} — today with a real case, because these principles applied seriously look like this:` },
        { p: `A restaurant brand we work with grew <strong>revenue +288% and orders +400% in the first half of the year</strong>, with <strong>3,617 orders driven by campaigns and a net ROAS of 14.6x</strong>.` },
        { p: `What did we do? Nothing magical: execution with a system. A menu built for delivery (photos, descriptions, channel-only offers), campaigns measured by margin rather than volume, and a dashboard to make decisions with numbers every week.` },
        { p: `The difference between reading the guide and getting these results is execution. If you want to see what the numbers could look like for ${emp}, let's start with a free audit:` },
        { cta: true },
        { p: `Best,<br>Darío` },
      ];
    } else {
      subject = `Last one from me${rawName ? ", " + rawName : ""}`;
      blocks = [
        { p: `${n ? n + ", I" : "I"} promise this is the last email I'll send you about this.` },
        { p: `If delivery at ${emp} is already where you want it, great — archive this and move on.` },
        { p: `But if you still feel you sell well and keep too little, that commissions eat into everything, or that you're deciding blind… those are exactly the problems we solve every day. The audit is free and comes with no strings attached:` },
        { cta: true },
        { p: `Whatever you decide, keep following what we share on <a href="${INSTAGRAM}" style="color:${BRAND}">Instagram, @mevakfoodagency</a> — we post industry data every week.` },
        { p: `All the best,<br>Darío` },
      ];
    }
  } else {
    const hola = n ? `Hola ${n}` : "Hola";
    if (step === 1) {
      subject = `¿Pudiste aplicar algo ${deGuide(guideRaw)}${rawName ? ", " + rawName : ""}?`;
      blocks = [
        { p: `${hola}, soy Darío, de Mevak. Te escribo porque descargaste ${g}.` },
        { p: `Pregunta corta: <strong>¿llegaste a aplicar algo?</strong>` },
        { p: `Te lo pregunto porque pasa siempre lo mismo: la guía se lee, se detectan dos o tres fugas (comisiones, carta, números que nadie mira)… y después la operación del día a día se la come.` },
        { p: `Si me contás cómo viene ${emp} con el delivery, te respondo yo mismo con lo que más margen mueve en tu caso. Sin vueltas.` },
        { p: `Y si preferís que lo miremos con tus números, pedí la auditoría gratis:` },
        { cta: true },
        { p: `Abrazo,<br>Darío` },
      ];
    } else if (step === 2) {
      subject = "+288% de facturación en un semestre (te cuento cómo)";
      blocks = [
        { p: `${hola}, sigo con lo ${deGuide(g)} — pero hoy con un caso real, porque los principios aplicados en serio dan esto:` },
        { p: `Una marca gastronómica con la que trabajamos logró <strong>+288% de facturación y +400% de pedidos en el primer semestre</strong>, con <strong>3.617 pedidos generados por campañas y un ROAS neto de 14,6x</strong>.` },
        { p: `¿Qué hicimos? Nada mágico: ejecución con sistema. Carta adaptada a delivery (fotos, descripciones, propuestas solo para el canal), campañas medidas por margen y no por volumen, y un tablero para decidir con números todas las semanas.` },
        { p: `La diferencia entre leer la guía y tener estos resultados es la ejecución. Si querés ver qué números daría ${emp}, empezamos por una auditoría gratis:` },
        { cta: true },
        { p: `Abrazo,<br>Darío` },
      ];
    } else {
      subject = `Última de mi parte${rawName ? ", " + rawName : ""}`;
      blocks = [
        { p: `${n ? n + ", t" : "T"}e prometo que esta es la última que te mando sobre esto.` },
        { p: `Si el delivery de ${emp} ya está donde querés, perfecto — archivá este mail y listo.` },
        { p: `Pero si todavía sentís que facturás bien y te queda poco, que las comisiones te comen o que decidís a ciegas… son exactamente los problemas que resolvemos todos los días. La auditoría es sin cargo y sin compromiso:` },
        { cta: true },
        { p: `Sea cual sea tu decisión, seguí lo que compartimos en <a href="${INSTAGRAM}" style="color:${BRAND}">Instagram, @mevakfoodagency</a> — ahí publicamos data del sector todas las semanas.` },
        { p: `Abrazo grande,<br>Darío` },
      ];
    }
  }
  return { subject, ...build(blocks, step, lang, unsubUrl) };
}

// ---------- Resend ----------
/**
 * Calls Resend directly when the key is a native key ("re_…"), otherwise through the Lovable connector gateway.
 * `keyEnv` picks the account: RESEND_API_KEY (sending, mevak.com.ar) or RESEND_API_KEY_INBOUND (receiving, r.mevak.com.ar).
 */
export async function resendFetch(path: string, init: { method?: string; body?: unknown } = {}, keyEnv = "RESEND_API_KEY") {
  const key = env(keyEnv);
  if (!key) throw new Error(`${keyEnv} not configured`);
  let url: string; const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key.startsWith("re_")) {
    url = `https://api.resend.com${path}`;
    headers.Authorization = `Bearer ${key}`;
  } else {
    const lovable = env("LOVABLE_API_KEY");
    if (!lovable) throw new Error("resend_not_configured");
    url = `https://connector-gateway.lovable.dev/resend${path}`;
    headers.Authorization = `Bearer ${lovable}`;
    headers["X-Connection-Api-Key"] = key;
  }
  const r = await fetch(url, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`[${r.status}] ${text}`);
  return text ? JSON.parse(text) : {};
}

export type SendOpts = { to: string; subject: string; html: string; text: string; unsubUrl?: string; replyTo?: string; from?: string };
export async function sendResend(o: SendOpts): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (o.unsubUrl) {
    headers["List-Unsubscribe"] = `<mailto:${UNSUB_MAILTO}?subject=baja>, <${o.unsubUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const res = await resendFetch("/emails", {
    method: "POST",
    body: { from: o.from ?? FROM, to: [o.to], subject: o.subject, html: o.html, text: o.text, reply_to: o.replyTo ?? replyTo(), headers },
  });
  return (res as { id?: string }).id ?? null;
}

export async function signProspect(id: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
