const pad2 = (n: number) => String(n).padStart(2, "0");

// Rango [from, to) del mes en curso, en ISO local (sin conversión de zona),
// para que los períodos semanales (lunes) queden bien incluidos.
export function monthBounds(base = new Date()): { from: string; to: string } {
  const y = base.getFullYear();
  const m = base.getMonth();
  const from = `${y}-${pad2(m + 1)}-01`;
  const to = m === 11 ? `${y + 1}-01-01` : `${y}-${pad2(m + 2)}-01`;
  return { from, to };
}

export type PeriodPreset = "current" | "lastMonth" | "3m" | "6m" | "12m" | "custom";

const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Rango [from, to) en fechas locales y cantidad de meses calendario (mín. 1).
// "Últimos N meses" incluye el mes en curso. Custom: "hasta" es inclusive.
export function periodRange(preset: PeriodPreset, base = new Date(), customFrom = "", customTo = ""): { from: string; to: string; months: number } {
  const cur = monthBounds(base);
  if (preset === "custom" && customFrom && customTo && customFrom <= customTo) {
    const [y, m, d] = customTo.split("-").map(Number);
    const to = iso(new Date(y, m - 1, d + 1));
    const [fy, fm] = customFrom.split("-").map(Number);
    const months = Math.max(1, (y - fy) * 12 + (m - fm) + 1);
    return { from: customFrom, to, months };
  }
  if (preset === "lastMonth") {
    const from = iso(new Date(base.getFullYear(), base.getMonth() - 1, 1));
    return { from, to: cur.from, months: 1 };
  }
  const n = preset === "3m" ? 3 : preset === "6m" ? 6 : preset === "12m" ? 12 : 1;
  const from = iso(new Date(base.getFullYear(), base.getMonth() - (n - 1), 1));
  return { from, to: cur.to, months: n };
}
