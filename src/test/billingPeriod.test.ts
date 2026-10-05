import { describe, it, expect } from "vitest";
import { monthBounds, periodRange } from "@/lib/billingPeriod";

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

describe("período del dashboard", () => {
  const base = new Date(2026, 9, 5);
  it("mes actual = octubre, 1 mes", () => {
    expect(periodRange("current", base)).toEqual({ from: "2026-10-01", to: "2026-11-01", months: 1 });
  });
  it("últimos 3 meses = ago a oct", () => {
    expect(periodRange("3m", base)).toEqual({ from: "2026-08-01", to: "2026-11-01", months: 3 });
  });
  it("últimos 12 meses cruza el año", () => {
    expect(periodRange("12m", base)).toEqual({ from: "2025-11-01", to: "2026-11-01", months: 12 });
  });
  it("rango personalizado incluye el día hasta y cuenta meses calendario", () => {
    expect(periodRange("custom", base, "2026-07-15", "2026-09-10")).toEqual({ from: "2026-07-15", to: "2026-09-11", months: 3 });
  });
});
