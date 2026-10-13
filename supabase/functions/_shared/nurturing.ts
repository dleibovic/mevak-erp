export const FROM = "Darío Leibovic <dario@mevakfoodagency.com>";
const BOOK = "https://growth.mevakfoodagency.com/book?utm_source=email&utm_medium=nurture&utm_campaign=sec_guia&utm_content=";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function signProspect(id: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const btn = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#5B55D6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;font-weight:600">${label}</a></p>`;

function layout(body: string, unsubUrl: string) {
  return `<!doctype html><html><body style="margin:0;background:#F4F2EC;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2B2833">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;font-size:16px;line-height:1.6">
${body}
<p style="margin-top:28px;color:#6B6775;font-size:14px">Darío Leibovic — Growth, AI &amp; Marketing · Mevak</p>
</div>
<p style="max-width:600px;margin:16px auto 0;text-align:center;font-size:12px;color:#6B6775"><a href="${unsubUrl}" style="color:#6B6775">No quiero recibir más estos mails</a></p>
</body></html>`;
}

export function renderStep(step: 1 | 2 | 3, nombreRaw: string, empresaRaw: string, unsubUrl: string) {
  const nombre = esc(nombreRaw || "");
  const empresa = esc(empresaRaw || "tu negocio");
  const sNombre = nombreRaw || "";
  if (step === 1) return {
    subject: `¿Pudiste aplicar algo de la guía${sNombre ? ", " + sNombre : ""}?`,
    html: layout(`<p>Hola ${nombre}, soy Darío Leibovic — te escribo porque descargaste la guía de las 6 tácticas para hacer más rentable tu delivery.</p>
<p>Pregunta corta: <strong>¿llegaste a aplicar algo?</strong></p>
<p>Te lo pregunto porque pasa siempre lo mismo: la guía se lee, se detectan dos o tres fugas (comisiones, carta, números que nadie mira)… y después la operación del día a día se la come.</p>
<p>Si me respondés contándome cómo viene ${empresa} con el delivery, te contesto yo mismo con el punto de la guía que más margen mueve en tu caso. Sin vueltas.</p>
<p>Y si preferís resolverlo en una llamada de 20 minutos, agendá directo acá:</p>${btn(BOOK + "mail1", "Agendar llamada →")}
<p>Abrazo,<br>Darío</p>`, unsubUrl),
  };
  if (step === 2) return {
    subject: "+288% en un trimestre (te cuento cómo)",
    html: layout(`<p>Hola ${nombre}, sigo con lo de la guía — pero hoy con un caso real, porque los principios aplicados en serio dan esto:</p>
<p>Una marca gastronómica con la que trabajamos creció <strong>+288% en facturación, +400% en órdenes y +34% en ticket promedio, en un solo trimestre</strong>. Sin descuentos que funden el margen.</p>
<p>¿Qué hicimos? Lo mismo que dice la guía, pero ejecutado con sistema: catálogo adaptado a delivery (fotos, descripciones, propuestas solo para el canal), tablero de control para decidir con números, y foco en proteger el margen neto de cada pedido.</p>
<p>La diferencia entre leer la guía y tener estos resultados es la ejecución. Si querés ver qué números daría tu operación, lo vemos en 20 minutos:</p>${btn(BOOK + "mail2", "Agendar llamada →")}
<p>Abrazo,<br>Darío</p>`, unsubUrl),
  };
  return {
    subject: `Última de mi parte${sNombre ? ", " + sNombre : ""}`,
    html: layout(`<p>${nombre}${nombre ? ", t" : "T"}e prometo que esta es la última que te mando sobre esto.</p>
<p>Si el delivery de ${empresa} ya está donde querés, perfecto — archivá este mail y listo.</p>
<p>Pero si todavía sentís que facturás bien y te queda poco, que las comisiones te comen, o que decidís a ciegas… son exactamente los tres problemas que resolvemos todos los días. Y el diagnóstico es gratis:</p>${btn(BOOK + "mail3", "20 minutos, agendá acá →")}
<p>Sea cual sea tu decisión, seguí recibiendo lo que comparto en <a href="https://www.instagram.com/darioleibovic" style="color:#5B55D6">Instagram</a> — ahí publico data del sector todas las semanas.</p>
<p>Abrazo grande,<br>Darío</p>`, unsubUrl),
  };
}

export const NEXT_DELAY_DAYS: Record<number, number | null> = { 1: 3, 2: 4, 3: null };

export async function sendResend(to: string, subject: string, html: string, unsubUrl: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error("resend_not_configured");
  const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, headers: { "List-Unsubscribe": `<${unsubUrl}>` } }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`[${r.status}] ${text}`);
  return (JSON.parse(text) as { id?: string }).id ?? null;
}
