import { describe, it, expect } from "vitest";
import { evalInvoice, totalsByCurrency, weeklyRangeLabels } from "@/lib/accountStatement";

const T = "2026-10-05";
const base = { period_month: "2026-09-01", currency: "USD" };

describe("estado de cuenta", () => {
  it("anulada: saldo 0 y fuera de totales", () => {
    const inv = { ...base, amount: 100, voided_at: "x" };
    expect(evalInvoice(inv, T)).toEqual({ state: "Anulada", saldo: 0 });
    expect(totalsByCurrency([inv], T).USD).toBeUndefined();
  });
  it("vencida con pago parcial", () => {
    expect(evalInvoice({ ...base, amount: 100, amount_paid: 40, due_date: "2026-10-01" }, T)).toEqual({ state: "Vencida (pago parcial)", saldo: 60 });
  });
  it("a vencer si due_date >= hoy", () => {
    expect(evalInvoice({ ...base, amount: 100, due_date: T }, T).state).toBe("A vencer");
  });
  it("incobrable no suma al saldo total", () => {
    const t = totalsByCurrency([
      { ...base, amount: 100, incobrable_at: "x", voided_at: "x" },
      { ...base, amount: 50, due_date: "2026-01-01" },
      { ...base, amount: 30, due_date: "2026-12-01" },
    ], T).USD;
    expect(t.incobrable).toBe(100);
    expect(t.vencido).toBe(50);
    expect(t.aVencer).toBe(30);
    expect(t.saldoTotal).toBe(80);
});

describe("rangos semanales", () => {
  it("calcula el fin como el período siguiente menos 1 día", () => {
    const labels = weeklyRangeLabels(["2026-09-08", "2026-09-15", "2026-09-22"]);
    expect(labels["2026-09-08"]).toBe("08/09 – 14/09");
    expect(labels["2026-09-15"]).toBe("15/09 – 21/09");
    expect(labels["2026-09-22"]).toBe("22/09 – 28/09");
  });
  it("la última semana cubre 7 días y cruza de mes sin desfase", () => {
    const labels = weeklyRangeLabels(["2026-09-29"]);
    expect(labels["2026-09-29"]).toBe("29/09 – 05/10");
  });
});

});
