import { describe, expect, it } from "vitest";
import { auditParamValue, formatAuditDate, matchesAuditFilter, parseAuditParam, sortForAudit } from "@/lib/prospectAudit";

const pidio = { id: "a", audit_requested_at: "2026-10-20T12:00:00Z" };
const noPidio = { id: "b", audit_requested_at: null };

describe("filtro Pidió auditoría", () => {
  it("Sí deja solo los que tienen audit_requested_at", () => {
    expect([pidio, noPidio].filter((p) => matchesAuditFilter(p, "yes")).map((p) => p.id)).toEqual(["a"]);
  });
  it("No deja solo los que no lo tienen", () => {
    expect([pidio, noPidio].filter((p) => matchesAuditFilter(p, "no")).map((p) => p.id)).toEqual(["b"]);
  });
  it("Todos deja a ambos", () => {
    expect([pidio, noPidio].filter((p) => matchesAuditFilter(p, "all"))).toHaveLength(2);
  });
  it("la URL usa ?auditoria=si|no", () => {
    expect(parseAuditParam("si")).toBe("yes");
    expect(parseAuditParam("no")).toBe("no");
    expect(parseAuditParam(null)).toBe("all");
    expect(auditParamValue("yes")).toBe("si");
    expect(auditParamValue("all")).toBeNull();
  });
  it("con Sí ordena por pedido más reciente primero", () => {
    const rows = [
      { id: "viejo", audit_requested_at: "2026-10-01T10:00:00Z" },
      { id: "nuevo", audit_requested_at: "2026-10-30T10:00:00Z" },
    ];
    expect(sortForAudit(rows, "yes").map((r) => r.id)).toEqual(["nuevo", "viejo"]);
    expect(sortForAudit(rows, "all").map((r) => r.id)).toEqual(["viejo", "nuevo"]);
  });
  it("la fecha sale en hora de Buenos Aires", () => {
    // 01:30 UTC del 1/11 todavía es 31/10 en Buenos Aires (UTC-3)
    expect(formatAuditDate("2026-11-01T01:30:00Z")).toBe("31/10/2026");
  });
});
