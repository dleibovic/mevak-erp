export const LOWEST_RATE_BY_MONTH: Record<string, number> = {
  "2026-06": 1445,
  "2026-07": 1495,
  "2026-08": 1510,
  "2026-09": 1530,
};
export const EUR_USD = 1.165;

export function defaultRateFor(periodMonth?: string | null): string {
  const r = periodMonth ? LOWEST_RATE_BY_MONTH[periodMonth.slice(0, 7)] : undefined;
  return r ? String(r) : "";
}

/** Valor completo en USD del saldo incobrable. NaN si falta dólar para ARS. */
export function incobrableUsd(saldo: number, currency: string, rate: number): number {
  if (currency === "USD") return saldo;
  if (currency === "EUR") return saldo * EUR_USD;
  return rate > 0 ? saldo / rate : NaN;
}
