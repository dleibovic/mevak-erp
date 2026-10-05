import { describe, it, expect } from "vitest";
import { evalInvoice, totalsByCurrency } from "@/lib/accountStatement";

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
});
