import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auditUrl, calendlyUrl, evaluateEligibility, guideName, isAuditOrigin, isValidEmail, pickLang, renderStep, type EligibilityInput } from "../_shared/nurturing.ts";
import { assetsBase, AVATAR_URL, avatarUrl, card, DEFAULT_ASSETS_BASE, h1, INSTAGRAM_URL, LOGO_URL, logoUrl, monthLabel, YOUTUBE_URL } from "../_shared/email-layout.ts";

const U = "https://x.test/unsub?p=1";
const OCT = new Date("2026-10-23T20:00:00Z");

Deno.test("mapa de guías: claves conocidas y default", () => {
  assertEquals(guideName("guia_6_tacticas"), "“6 Tácticas para rentabilizar tu delivery”");
  assertEquals(guideName("guia_vara_digital"), "“15,7%: la vara real de tu canal digital”");
  assertEquals(guideName("geo_guide"), "la guía de GEO");
  assertEquals(guideName("lead_magnet"), "el Scorecard de rentabilidad");
  assertEquals(guideName("biblioteca_guias"), "las guías de Mevak");
  assertEquals(guideName("cualquier_cosa"), "nuestra guía");
  assertEquals(guideName(null, "en"), "our guide");
});

Deno.test("idioma: EN para US/CA/GB, ES para el resto", () => {
  assertEquals(pickLang("US"), "en");
  assertEquals(pickLang("ca"), "en");
  assertEquals(pickLang("GB"), "en");
  assertEquals(pickLang("AR"), "es");
  assertEquals(pickLang("ES", "en"), "es");
  assertEquals(pickLang(null, "en"), "en");
});

for (const lang of ["es", "en"] as const) {
  for (const step of [1, 2, 3] as const) {
    Deno.test(`mail ${step} ${lang}: con y sin nombre, plantilla Mevak, links y baja`, () => {
      const withName = renderStep(step, { nombre: "Juan", empresa: "La Parrilla", guideKey: "guia_sorteo", lang, now: OCT }, U);
      const noName = renderStep(step, { nombre: "", empresa: "", guideKey: "guia_sorteo", lang, now: OCT }, U);
      for (const m of [withName, noName]) {
        assertStringIncludes(m.html, auditUrl(step));
        assertStringIncludes(m.html, calendlyUrl(step));
        assertStringIncludes(m.html, "#555EC3");
        assertStringIncludes(m.html, "max-width:600px");
        // Cabecera: logo blanco con link al sitio, bajada y mes
        assertStringIncludes(m.html, LOGO_URL);
        assertStringIncludes(m.html, "https://www.mevakfoodagency.com/?utm_source=email&utm_medium=nurture");
        assertStringIncludes(m.html, lang === "es" ? "Novedades de delivery, datos y GEO · por Darío Leibovic" : "Delivery, data &amp; GEO news · by Darío Leibovic");
        assertStringIncludes(m.html, lang === "es" ? "Octubre 2026" : "October 2026");
        // Firma: foto, rol, invitación a redes y dos píldoras
        assertStringIncludes(m.html, AVATAR_URL);
        assertStringIncludes(m.html, lang === "es" ? "Cofundador · Mevak Food Agency" : "Co-founder · Mevak Food Agency");
        assertStringIncludes(m.html, lang === "es" ? "publico algo nuevo todos los días" : "I post something new every day");
        assertStringIncludes(m.html, `href="${INSTAGRAM_URL}"`);
        assertStringIncludes(m.html, `href="${YOUTUBE_URL}"`);
        assertStringIncludes(m.html, lang === "es" ? "Seguir en Instagram" : "Follow on Instagram");
        assertStringIncludes(m.html, lang === "es" ? "Suscribirse en YouTube" : "Subscribe on YouTube");
        // Pie con motivo y baja real
        assertStringIncludes(m.html, lang === "es"
          ? "Recibís este mail porque descargaste una guía en www.mevakfoodagency.com."
          : "You're receiving this email because you downloaded a guide at www.mevakfoodagency.com.");
        assertStringIncludes(m.html, `<a href="${U}" style="color:#6B6775">${lang === "es" ? "Darse de baja" : "Unsubscribe"}</a>`);
        assertStringIncludes(m.html, "Buenos Aires · Madrid · Miami");
        assert(!m.html.includes("María Dean"), "firma vieja eliminada");
        assert(!m.html.includes("display:flex"), "sin flex");
        // Texto plano: CTA, firma, redes y baja
        assertStringIncludes(m.text, auditUrl(step));
        assertStringIncludes(m.text, INSTAGRAM_URL);
        assertStringIncludes(m.text, YOUTUBE_URL);
        assertStringIncludes(m.text, lang === "es" ? "todos los días" : "every day");
        assertStringIncludes(m.text, `${lang === "es" ? "Darse de baja" : "Unsubscribe"}: ${U}`);
        assert(!m.text.includes("<"), "texto plano sin HTML");
        assert(!m.subject.includes("undefined") && !m.html.includes("undefined"));
        assert(!m.html.includes("/book"));
      }
      if (step !== 2) assertStringIncludes(withName.subject, "Juan");
      assert(!noName.subject.includes(", ?") && !noName.subject.endsWith(", "));
      assertStringIncludes(withName.html, "La Parrilla");
      assertStringIncludes(noName.html, lang === "es" ? "tu negocio" : "your business");
    });
  }
}

Deno.test("imágenes desde host estable, no desde el sitio", () => {
  const b = "https://midtcgocljahzzwxdaex.supabase.co/functions/v1/email-assets";
  assertEquals(DEFAULT_ASSETS_BASE, b);
  assertEquals(logoUrl(assetsBase("")), `${b}/logo-mevak-white.png`);
  assertEquals(avatarUrl(assetsBase("")), `${b}/dario-avatar.jpg`);
  assertEquals(logoUrl(assetsBase("https://cdn.test/x/")), "https://cdn.test/x/logo-mevak-white.png");
  const html = renderStep(1, { nombre: "Ana" }, U).html;
  for (const m of html.matchAll(/<img src="([^"]+)"/g)) assert(!m[1].includes("mevakfoodagency.com"), m[1]);
  assertStringIncludes(html, "https://www.mevakfoodagency.com/?utm_source=email&utm_medium=nurture");
});

Deno.test("mes de cabecera en hora de Buenos Aires", () => {
  assertEquals(monthLabel(new Date("2026-11-01T02:00:00Z")), "Octubre 2026");
  assertEquals(monthLabel(new Date("2026-11-01T04:00:00Z"), "en"), "November 2026");
});

Deno.test("helpers reutilizables: h1 con palabra clave y tarjeta apilable", () => {
  assertStringIncludes(h1("Un sorteo que trae pedidos", "pedidos"), '<span style="color:#DE2D03">pedidos</span>');
  const c = card({ imageUrl: "https://x.test/p.jpg", label: "Guía nueva", title: "T", button: { label: "Ver", href: "https://x.test" } });
  assertStringIncludes(c, 'class="stack"');
  assertStringIncludes(c, "border:1px solid #E8E5DD;border-radius:16px");
});

Deno.test("mail 1 ES: asunto con guía y nombre; 'de el' se contrae", () => {
  assertEquals(renderStep(1, { nombre: "Ana", guideKey: "guia_6_tacticas" }, U).subject, "¿Pudiste aplicar algo de “6 Tácticas para rentabilizar tu delivery”, Ana?");
  assertEquals(renderStep(1, { guideKey: "lead_magnet" }, U).subject, "¿Pudiste aplicar algo del Scorecard de rentabilidad?");
});

Deno.test("mail 2: caso real corregido", () => {
  const es = renderStep(2, { guideKey: "x" }, U).html;
  for (const s of ["+288%", "+400%", "primer semestre", "3.617", "14,6x"]) assertStringIncludes(es, s);
  assert(!es.includes("+34%"));
  const en = renderStep(2, { guideKey: "x", lang: "en" }, U).html;
  for (const s of ["+288%", "+400%", "3,617", "14.6x"]) assertStringIncludes(en, s);
});

Deno.test("mail 3: Instagram @mevakfoodagency", () => {
  assertStringIncludes(renderStep(3, {}, U).html, "instagram.com/mevakfoodagency");
  assertStringIncludes(renderStep(3, {}, U).subject, "Última de mi parte");
});

Deno.test("escapa HTML del nombre y empresa", () => {
  const m = renderStep(1, { nombre: "<b>x</b>", empresa: "A&B" }, U);
  assert(!m.html.includes("<b>x</b>"));
  assertStringIncludes(m.html, "A&amp;B");
});

const base: EligibilityInput = { email: "a@b.com", marketing_opt_in: true, unsubscribed_at: null, email_bounced: false, audit_requested_at: null, guide_downloaded: "guia_sorteo", status: "active", stage_order: 1, stage_name: "Nuevo Contacto" };

Deno.test("elegibilidad: caso apto", () => assertEquals(evaluateEligibility(base), { ok: true }));
Deno.test("elegibilidad: sin opt-in o con baja", () => {
  assertEquals(evaluateEligibility({ ...base, marketing_opt_in: false }), { ok: false, reason: "baja" });
  assertEquals(evaluateEligibility({ ...base, unsubscribed_at: "2026-10-01" }), { ok: false, reason: "baja" });
});
Deno.test("elegibilidad: rebote y email inválido", () => {
  assertEquals(evaluateEligibility({ ...base, email_bounced: true }), { ok: false, reason: "rebote" });
  assertEquals(evaluateEligibility({ ...base, email: "x@gmail.con" }), { ok: false, reason: "email_invalido" });
  assertEquals(evaluateEligibility({ ...base, email: "sin-arroba" }), { ok: false, reason: "email_invalido" });
});
Deno.test("elegibilidad: stop por auditoría", () => {
  assertEquals(evaluateEligibility({ ...base, audit_requested_at: "2026-10-20" }), { ok: false, reason: "pidio_auditoria" });
  assertEquals(evaluateEligibility({ ...base, guide_downloaded: "lead_form" }), { ok: false, reason: "pidio_auditoria" });
  assertEquals(evaluateEligibility({ ...base, guide_downloaded: "auditoria_home" }), { ok: false, reason: "pidio_auditoria" });
});
Deno.test("elegibilidad: etapa Interesado o superior / cerrado", () => {
  assertEquals(evaluateEligibility({ ...base, stage_order: 2, stage_name: "Contactado" }), { ok: true });
  assertEquals(evaluateEligibility({ ...base, stage_order: 3, stage_name: "Interesado" }), { ok: false, reason: "avanzo_etapa" });
  assertEquals(evaluateEligibility({ ...base, stage_order: 8, stage_name: "Cerrado Perdido" }), { ok: false, reason: "avanzo_etapa" });
  assertEquals(evaluateEligibility({ ...base, status: "lost" }), { ok: false, reason: "avanzo_etapa" });
});

Deno.test("origen de auditoría", () => {
  assert(isAuditOrigin("auditoria_home"));
  assert(isAuditOrigin("Lead_Form"));
  assert(isAuditOrigin("booking_call"));
  assert(!isAuditOrigin("guia_6_tacticas"));
  assert(!isAuditOrigin(null));
});

Deno.test("email válido", () => {
  assert(isValidEmail("juan@empresa.com.ar"));
  assert(!isValidEmail("juan@gmial.com"));
});
