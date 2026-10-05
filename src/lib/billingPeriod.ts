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
