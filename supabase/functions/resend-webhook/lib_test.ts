import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bareEmail, forwardMessage, parseReceived, replySnippet, sendPatchFor, svixSign, verifySvix } from "./lib.ts";

const SECRET = "whsec_" + btoa("super-secret-key-for-tests-123456");
const BODY = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
const NOW = 1_800_000_000;

Deno.test("svix: firma válida", async () => {
  const sig = await svixSign(SECRET, "msg_1", String(NOW), BODY);
  assert(await verifySvix(SECRET, { id: "msg_1", timestamp: String(NOW), signature: `v1,${sig}` }, BODY, NOW));
  // Several signatures (secret rotation): any match passes.
  assert(await verifySvix(SECRET, { id: "msg_1", timestamp: String(NOW), signature: `v1,AAAA v1,${sig}` }, BODY, NOW));
});

Deno.test("svix: firma inválida, body alterado, vencida o sin headers", async () => {
  const sig = await svixSign(SECRET, "msg_1", String(NOW), BODY);
  assert(!(await verifySvix(SECRET, { id: "msg_1", timestamp: String(NOW), signature: "v1,bad" }, BODY, NOW)));
  assert(!(await verifySvix(SECRET, { id: "msg_1", timestamp: String(NOW), signature: `v1,${sig}` }, BODY + " ", NOW)));
  assert(!(await verifySvix(SECRET, { id: "msg_1", timestamp: String(NOW), signature: `v1,${sig}` }, BODY, NOW + 600)));
  assert(!(await verifySvix(SECRET, { id: null, timestamp: String(NOW), signature: `v1,${sig}` }, BODY, NOW)));
  assert(!(await verifySvix("whsec_" + btoa("otro"), { id: "msg_1", timestamp: String(NOW), signature: `v1,${sig}` }, BODY, NOW)));
});

Deno.test("eventos: patch de sequence_sends sin retroceder estado", () => {
  assertEquals(sendPatchFor("email.delivered", "t1", { status: "sent" }), { delivered_at: "t1", status: "delivered" });
  assertEquals(sendPatchFor("email.opened", "t2", { status: "clicked", opened_at: null }), { opened_at: "t2" });
  assertEquals(sendPatchFor("email.clicked", "t3", { status: "opened", clicked_at: "t0" }), { status: "clicked" });
  assertEquals(sendPatchFor("email.bounced", "t4", { status: "delivered" }), { bounced_at: "t4", status: "bounced" });
  assertEquals(sendPatchFor("email.sent", "t", {}), null);
});

const RECEIVED = {
  type: "email.received",
  created_at: "2026-10-23T18:00:00.000Z",
  data: {
    email_id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
    created_at: "2026-10-23T18:00:00.000Z",
    from: "Juan Pérez <Juan@LaParrilla.com>",
    to: ["dario@r.mevak.com.ar"],
    subject: "Re: ¿Pudiste aplicar algo?",
    text: "Hola Darío, sí, me interesa la auditoría.\n\nEl jue, 22 oct 2026 a las 10:00, Darío escribió:\n> Pregunta corta",
  },
};

Deno.test("email.received: parse del payload", () => {
  const r = parseReceived(RECEIVED);
  assertEquals(r.emailId, "4ef9a417-02e9-4d39-ad75-9611e0fcc33c");
  assertEquals(r.from, "juan@laparrilla.com");
  assertEquals(r.to, ["dario@r.mevak.com.ar"]);
  assertEquals(r.subject, "Re: ¿Pudiste aplicar algo?");
  assertEquals(replySnippet(r.text, r.html), "Hola Darío, sí, me interesa la auditoría.");
});

Deno.test("email.received: sin cuerpo (solo metadata) y html", () => {
  const r = parseReceived({ type: "email.received", data: { email_id: "x", from: "a@b.com", to: "c@d.com" } });
  assertEquals(r.text, null);
  assertEquals(r.subject, "(sin asunto)");
  assertEquals(replySnippet(null, "<p>Hola</p><p>mundo</p>"), "Hola mundo");
  assertEquals(replySnippet("x".repeat(400), null).length, 301);
});

Deno.test("reenvío a Darío: asunto y reply", () => {
  const f = forwardMessage(parseReceived(RECEIVED), "La Parrilla");
  assertEquals(f.subject, "Re: ¿Pudiste aplicar algo? — respuesta de La Parrilla");
  assertStringIncludes(f.text, "me interesa la auditoría");
  assertEquals(bareEmail("x@y.com"), "x@y.com");
});
