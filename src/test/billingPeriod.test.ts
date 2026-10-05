import { describe, it, expect } from "vitest";
import { monthBounds } from "@/lib/billingPeriod";

const inRange = (p: string, b: { from: string; to: string }) => p >= b.from && p < b.to;

describe("rango del mes en curso", () => {
  it("va del día 1 inclusive al día 1 del mes siguiente exclusive", () => {
    expect(monthBounds(new Date(2026, 8, 17))).toEqual({ from: "2026-09-01", to: "2026-10-01" });
  });
  it("incluye los períodos semanales (lunes) del mes", () => {
    const b = monthBounds(new Date(2026, 8, 17));
    expect(inRange("2026-09-07", b)).toBe(true);
    expect(inRange("2026-09-28", b)).toBe(true);
  });
  it("excluye el lunes de la última semana del mes anterior", () => {
    const b = monthBounds(new Date(2026, 8, 17));
    expect(inRange("2026-08-31", b)).toBe(false);
  });
  it("diciembre cierra en enero del año siguiente", () => {
    expect(monthBounds(new Date(2026, 11, 30))).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });
});
