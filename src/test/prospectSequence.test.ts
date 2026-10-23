import { describe, expect, it } from "vitest";
import { canResume, sendBadges, sequencePill, sequenceStatusLabel } from "@/lib/prospectSequence";

describe("secuencia de mails en Prospecting", () => {
  it("una respuesta se destaca aunque la secuencia esté frenada", () => {
    const seq = { status: "stopped", current_step: 1, stop_reason: "respondio", replied_at: "2026-10-23T18:00:00Z" };
    expect(sequenceStatusLabel(seq)).toBe("Respondió");
    expect(sequencePill(seq)).toEqual({ label: "Respondió", tone: "replied" });
  });

  it("muestra el motivo de stop", () => {
    expect(sequenceStatusLabel({ status: "stopped", current_step: 0, stop_reason: "pidio_auditoria" })).toBe("Frenada · Pidió auditoría");
    expect(sequenceStatusLabel({ status: "stopped", current_step: 0, stop_reason: "antiguo" })).toBe("Frenada · Lead antiguo (+21 días)");
  });

  it("no se puede reanudar a quien se dio de baja, rebotó o marcó spam", () => {
    for (const r of ["baja", "rebote", "queja"]) expect(canResume({ status: "stopped", current_step: 1, stop_reason: r }, true)).toBe(false);
    expect(canResume({ status: "stopped", current_step: 1, stop_reason: "manual" }, true)).toBe(true);
    expect(canResume({ status: "stopped", current_step: 1, stop_reason: "manual" }, false)).toBe(false);
    expect(canResume({ status: "stopped", current_step: 3, stop_reason: "manual" }, true)).toBe(false);
  });

  it("estado de cada envío: entregado, abierto, clic, rebote", () => {
    expect(sendBadges({ status: "sent" })).toEqual(["Enviado"]);
    expect(sendBadges({ status: "clicked", delivered_at: "a", opened_at: "b", clicked_at: "c" })).toEqual(["Entregado", "Abierto", "Clic"]);
    expect(sendBadges({ status: "bounced", bounced_at: "x" })).toEqual(["Rebotó"]);
  });

  it("en el listado, una activa en paso 1 muestra el próximo mail", () => {
    expect(sequencePill({ status: "active", current_step: 1 })).toEqual({ label: "Mail 2/3", tone: "active" });
  });
});
