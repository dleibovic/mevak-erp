import { describe, expect, it } from "vitest";
import { debtBalances, originMonth, paymentInUsd, type PartnerDebtMovement } from "@/lib/partnerDebt";

const movement = (id: string, ledger: string, amount_usd: number, entry_date: string): PartnerDebtMovement => ({
  id, ledger, amount_usd, entry_date, created_at: `${entry_date}T12:00:00Z`, entry_type: "payment",
  concept: null, origin_period: null, origin_rate_ars: null, amount_ars_origin: null,
});

describe("deuda entre socios", () => {
  it("acumula cada ledger por fecha, restando los pagos sin mezclar deudas", () => {
    const result = debtBalances([
      movement("3", "meri", -500, "2026-07-01"),
      movement("2", "empresa", 588.24, "2026-06-02"),
      movement("1", "meri", 20000, "2026-06-01"),
    ]);
    expect(result.movements.map((row) => row.runningBalance)).toEqual([20000, 588.24, 19500]);
    expect(result.balances).toEqual({ meri: 19500, empresa: 588.24 });
  });

  it("convierte pagos ARS a USD con el dólar ingresado y conserva USD directo", () => {
    expect(paymentInUsd(154500, "ARS", 1545)).toBe(100);
    expect(paymentInUsd(100, "USD", 1545)).toBe(100);
  });

  it("muestra el período de origen junio sin desfasarlo a mayo", () => {
    expect(originMonth("2026-06-01")).toMatch(/jun.*2026/i);
  });
});