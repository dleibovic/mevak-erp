// Mevak's single email template (approved by the owner). Table-based, inline styles, no flex;
// @media only for .pad and .stack. Pure helpers: no Deno globals so they can be unit-tested anywhere.

export type EmailLang = "es" | "en";

export const SITE = "https://www.mevakfoodagency.com";
export const LOGO_URL = `${SITE}/email/logo-mevak-white.png`;
export const AVATAR_URL = `${SITE}/email/dario-avatar.jpg`;
export const INSTAGRAM_URL = "https://www.instagram.com/darioleibovic";
export const YOUTUBE_URL = "https://www.youtube.com/@darioleibovic";

export const C = {
  page: "#F4F2EC",
  header: "#17162A",
  tagline: "#B9B6C6",
  month: "#8E8B9E",
  ink: "#1F1D33",
  muted: "#6B6775",
  line: "#E8E5DD",
  brand: "#555EC3",
  accent: "#DE2D03",
} as const;

const FONT = "font-family:Arial,Helvetica,sans-serif";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const T = {
  es: {
    role: "Cofundador · Mevak Food Agency",
    social: "Si querés estar siempre al tanto de las últimas novedades de delivery, datos y GEO, seguime en mis redes: publico algo nuevo todos los días.",
    ig: "Seguir en Instagram",
    yt: "Suscribirse en YouTube",
    because: "Recibís este mail porque",
    unsub: "Darse de baja",
    months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  },
  en: {
    role: "Co-founder · Mevak Food Agency",
    social: "If you want to stay on top of the latest delivery, data and GEO news, follow me on social media: I post something new every day.",
    ig: "Follow on Instagram",
    yt: "Subscribe on YouTube",
    because: "You're receiving this email because",
    unsub: "Unsubscribe",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
} as const;

const OFFICES = "Mevak Food Agency · Buenos Aires · Madrid · Miami";
export const siteUrl = (utmMedium: string) => `${SITE}/?utm_source=email&utm_medium=${encodeURIComponent(utmMedium)}`;

/** "Octubre 2026" / "October 2026", in Buenos Aires time (UTC−3). */
export function monthLabel(date: Date, lang: EmailLang = "es") {
  const d = new Date(date.getTime() - 3 * 3600_000);
  return `${T[lang].months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---------- Body helpers ----------
/** H1 27px/900; `keyword` (if present in the text) is painted in the accent red. Text is escaped. */
export function h1(text: string, keyword?: string) {
  let inner = esc(text);
  if (keyword) {
    const k = esc(keyword);
    const i = inner.indexOf(k);
    if (i >= 0) inner = `${inner.slice(0, i)}<span style="color:${C.accent}">${k}</span>${inner.slice(i + k.length)}`;
  }
  return `<h1 style="margin:0 0 24px;${FONT};font-size:27px;line-height:1.25;color:${C.ink};font-weight:900">${inner}</h1>`;
}

/** Body paragraph 17px/1.75. `html` is trusted markup (escape user data before). */
export const paragraph = (html: string) => `<p style="margin:0 0 16px;${FONT};font-size:17px;line-height:1.75;color:${C.ink}">${html}</p>`;

/** Pill button: primary = filled #555EC3; secondary = 2px #555EC3 outline. */
export function button(label: string, href: string, variant: "primary" | "secondary" = "primary") {
  const look = variant === "primary"
    ? `padding:15px 26px;background:${C.brand};color:#ffffff;border:0`
    : `padding:13px 24px;background:#ffffff;color:${C.brand};border:2px solid ${C.brand}`;
  return `<a href="${href}" style="display:inline-block;${look};border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;${FONT};margin:0 10px 10px 0">${esc(label)}</a>`;
}

/** Row of buttons with generous spacing above. */
export const buttonRow = (...buttons: string[]) => `<div style="margin:26px 0 16px">${buttons.join("")}</div>`;

/** Small outline pill (social links). */
export const pill = (label: string, href: string, color: string) =>
  `<a href="${href}" style="display:inline-block;padding:10px 16px;border-radius:999px;border:1.5px solid ${color};color:${color};text-decoration:none;font-weight:700;font-size:13px;${FONT};margin:0 8px 8px 0">${esc(label)}</a>`;

export type CardInput = { imageUrl?: string; imageAlt?: string; label?: string; title: string; description?: string; button?: { label: string; href: string } };
/** Content card: image 180px on the left + text; stacks on mobile (.stack). */
export function card(c: CardInput) {
  const img = c.imageUrl
    ? `<td width="180" valign="top" style="padding:16px 0 16px 16px"><img src="${c.imageUrl}" width="164" style="display:block;width:100%;height:auto;border-radius:10px" alt="${esc(c.imageAlt ?? "")}"></td>`
    : "";
  const label = c.label ? `<div style="${FONT};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.accent}">${esc(c.label)}</div>` : "";
  const desc = c.description ? `<div style="${FONT};font-size:14px;line-height:1.65;color:${C.muted};padding-bottom:14px">${esc(c.description)}</div>` : "";
  const btn = c.button
    ? `<a href="${c.button.href}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:${C.brand};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;${FONT}">${esc(c.button.label)}</a>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;border:1px solid ${C.line};border-radius:16px" class="stack"><tr>
${img}<td valign="top" style="padding:18px 20px 16px 16px">${label}<div style="${FONT};font-size:20px;font-weight:900;line-height:1.3;color:${C.ink};padding:6px 0 8px">${esc(c.title)}</div>${desc}${btn}</td></tr></table>`;
}

/** Darío's signature: separator, round photo, name/role, social invitation and the two pills. */
export function signature(lang: EmailLang = "es") {
  const t = T[lang];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:34px;border-top:1px solid ${C.line}"><tr><td style="padding-top:26px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:14px" valign="top"><img src="${AVATAR_URL}" width="56" height="56" alt="Darío Leibovic" style="display:block;width:56px;height:56px;border-radius:999px"></td>
<td style="${FONT};font-size:15px;line-height:1.55;color:${C.ink}" valign="top"><strong>Darío Leibovic</strong><br><span style="color:${C.muted}">${t.role}</span></td></tr></table>
<p style="margin:18px 0 12px;${FONT};font-size:15px;line-height:1.7;color:${C.ink}">${t.social}</p>
${pill(t.ig, INSTAGRAM_URL, C.accent)}${pill(t.yt, YOUTUBE_URL, C.brand)}
</td></tr></table>`;
}

export function signatureText(lang: EmailLang = "es") {
  const t = T[lang];
  return `Darío Leibovic\n${t.role}\n\n${t.social}\n${t.ig}: ${INSTAGRAM_URL}\n${t.yt}: ${YOUTUBE_URL}`;
}

export function footerText(lang: EmailLang, reasonText: string, unsubUrl: string, utmMedium = "nurture") {
  const t = T[lang];
  return `www.mevakfoodagency.com (${siteUrl(utmMedium)})\n${OFFICES}\n${t.because} ${reasonText}. ${t.unsub}: ${unsubUrl}`;
}

// ---------- Layout ----------
export type LayoutInput = {
  headerTagline: string;
  monthLabel: string;
  bodyHtml: string;
  lang: EmailLang;
  unsubUrl: string;
  /** Completes "Recibís este mail porque …" (no trailing period), e.g. "descargaste una guía en www.mevakfoodagency.com". */
  reasonText: string;
  /** utm_medium for the logo/site links (e.g. "nurture", "newsletter"). */
  utmMedium?: string;
  title?: string;
};

export function layout(o: LayoutInput) {
  const t = T[o.lang];
  const site = siteUrl(o.utmMedium ?? "nurture");
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(o.title ?? "Mevak")}</title>
<style>@media only screen and (max-width:620px){ .pad{padding:28px 22px !important} .stack td{display:block !important;box-sizing:border-box !important;width:100% !important;padding-left:16px !important;padding-right:16px !important;padding-top:12px !important} }</style></head>
<body style="margin:0;padding:0;background:${C.page}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr><td style="background:${C.header};border-radius:18px 18px 0 0;padding:26px 40px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><a href="${site}" style="text-decoration:none"><img src="${LOGO_URL}" width="120" alt="Mevak" style="display:block;width:120px;height:auto"></a>
<div style="${FONT};font-size:13px;line-height:1.5;color:${C.tagline};padding-top:6px">${esc(o.headerTagline)}</div></td>
<td align="right" valign="top" style="${FONT};font-size:12px;line-height:1.5;color:${C.month};white-space:nowrap">${esc(o.monthLabel)}</td></tr></table></td></tr>
<tr><td class="pad" style="background:#ffffff;padding:40px 44px 38px;border-radius:0 0 18px 18px">
${o.bodyHtml}
</td></tr><tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:26px 24px 8px;${FONT};font-size:12px;line-height:1.8;color:${C.muted}">
<a href="${site}" style="color:${C.brand};text-decoration:none;font-weight:700">www.mevakfoodagency.com</a><br>
${OFFICES}<br>
${t.because} ${esc(o.reasonText)}. <a href="${o.unsubUrl}" style="color:${C.muted}">${t.unsub}</a></td></tr></table></td></tr></table></td></tr></table></body></html>`;
}

/** Plain-text version of trusted body markup. */
export function htmlToText(h: string) {
  return h
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, "$2 ($1)")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
