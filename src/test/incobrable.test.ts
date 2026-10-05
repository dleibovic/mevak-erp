import { describe, it, expect } from "vitest";
import { defaultRateFor, incobrableUsd } from "@/lib/incobrable";

describe("incobrable", () => {
  it("prellena el dólar más bajo conocido del mes", () => {
    expect(defaultRateFor("2026-06-01")).toBe("1445");
    expect(defaultRateFor("2026-09-01")).toBe("1530");
    expect(defaultRateFor("2026-10-01")).toBe("");
  });
  it("ARS se divide por el dólar ingresado", () => {
    expect(incobrableUsd(1445000, "ARS", 1445)).toBe(1000);
  });
  it("USD queda igual y EUR se multiplica por 1.165", () => {
    expect(incobrableUsd(500, "USD", 0)).toBe(500);
    expect(incobrableUsd(1000, "EUR", 0)).toBeCloseTo(1165);
  });
});
