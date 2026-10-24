import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { enrollmentFor } from "../_shared/nurturing.ts";

const NOW = new Date("2026-10-24T22:00:00.000Z");
const IN_24H = "2026-10-25T22:00:00.000Z";

Deno.test("nuevo con opt-in → secuencia activa en 24 h", () => {
  assertEquals(enrollmentFor({ isNew: true, marketing: true, audit: false }, NOW), { status: "active", next_send_at: IN_24H });
});

Deno.test("existente sin opt-in previo y sin fila → crea secuencia activa en 24 h", () => {
  assertEquals(
    enrollmentFor({ isNew: false, marketing: true, audit: false, wasOptedIn: false, unsubscribed: false, hasSequenceRow: false }, NOW),
    { status: "active", next_send_at: IN_24H },
  );
});

Deno.test("existente con fila stopped/completed → no crea", () => {
  assertEquals(enrollmentFor({ isNew: false, marketing: true, audit: false, wasOptedIn: false, unsubscribed: false, hasSequenceRow: true }, NOW), null);
});

Deno.test("existente dado de baja → no crea", () => {
  assertEquals(enrollmentFor({ isNew: false, marketing: true, audit: false, wasOptedIn: false, unsubscribed: true, hasSequenceRow: false }, NOW), null);
});

Deno.test("sin opt-in en el envío → no crea", () => {
  assertEquals(enrollmentFor({ isNew: true, marketing: false, audit: false }, NOW), null);
});
