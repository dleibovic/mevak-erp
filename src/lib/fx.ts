// Conversión a USD usando la cotización del MES correspondiente (no la del día).
// exchange_rates guarda "unidades de moneda local por 1 USD" (base_currency, rate, rate_date).

export type RateRow = { base_currency: string; rate: number; rate_date: string };

export type RateIndex = Map<string, { month: string; rate: number }[]>;

export function buildRateIndex(rates: RateRow[]): RateIndex {
  const byCur: RateIndex = new Map();
  for (const r of rates ?? []) {
    const month = String(r.rate_date).slice(0, 7); // 'YYYY-MM'
    if (!byCur.has(r.base_currency)) byCur.set(r.base_currency, []);
    byCur.get(r.base_currency)!.push({ month, rate: Number(r.rate) });
  }
  for (const arr of byCur.values()) arr.sort((a, b) => a.month.localeCompare(b.month));
  return byCur;
}

/** Cotización vigente para el mes (la más reciente con month <= target). */
export function rateForMonth(
  index: RateIndex,
  currency: string,
  month: string,
): { rate: number | null; usedMonth: string | null; estimated: boolean } {
  if (!currency || currency === "USD") return { rate: 1, usedMonth: month, estimated: false };
  const arr = index.get(currency);
  if (!arr || arr.length === 0) return { rate: null, usedMonth: null, estimated: true };
  let chosen: { month: string; rate: number } | null = null;
  for (const r of arr) {
    if (r.month <= month) chosen = r;
    else break;
  }
  if (!chosen) {
    const first = arr[0];
    return { rate: first.rate, usedMonth: first.month, estimated: true };
  }
  return { rate: chosen.rate, usedMonth: chosen.month, estimated: chosen.month !== month };
}

/** Convierte un monto local a USD usando la cotización del mes indicado ('YYYY-MM' o fecha). */
export function toUsd(index: RateIndex, amount: number, currency: string, dateOrMonth: string | Date): number {
  const month = (typeof dateOrMonth === "string" ? dateOrMonth : dateOrMonth.toISOString()).slice(0, 7);
  const { rate } = rateForMonth(index, currency, month);
  if (!rate) return 0; // sin cotización disponible
  return (Number(amount) || 0) / rate;
}

/** Lista de meses 'YYYY-MM' dentro de [start, end). */
export function monthsList(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d < end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}
