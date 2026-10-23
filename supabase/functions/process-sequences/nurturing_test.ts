import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auditUrl, calendlyUrl, evaluateEligibility, guideName, isAuditOrigin, isValidEmail, pickLang, renderStep, type EligibilityInput } from "../_shared/nurturing.ts";

const U = "https://x.test/unsub?p=1";

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
    Deno.test(`mail ${step} ${lang}: con y sin nombre, links y baja`, () => {
      const withName = renderStep(step, { nombre: "Juan", empresa: "La Parrilla", guideKey: "guia_sorteo", lang }, U);
      const noName = renderStep(step, { nombre: "", empresa: "", guideKey: "guia_sorteo", lang }, U);
      for (const m of [withName, noName]) {
        assertStringIncludes(m.html, auditUrl(step));
        assertStringIncludes(m.html, calendlyUrl(step));
        assertStringIncludes(m.html, U);
        assertStringIncludes(m.html, "#555EC3");
        assertStringIncludes(m.html, "max-width:600px");
        assertStringIncludes(m.html, "Darío Leibovic y María Dean · Mevak Food Agency");
        assertStringIncludes(m.text, auditUrl(step));
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
