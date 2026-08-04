import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ALL_MONTHS = "all";

/** Valor del mes actual, en formato YYYY-MM-01 */
export function currentMonthValue() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
}

/** Lista de meses (mismo patrón que el selector de período de Facturación mensual). */
export function monthList(back = 11, forward = 1) {
  const now = new Date();
  const items: { value: string; label: string }[] = [];
  for (let i = -back; i <= forward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    items.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    });
  }
  return items.reverse();
}

/** Rango [start, end) del mes elegido en ISO date. null si es "Todos". */
export function monthRange(value: string): { start: string; end: string } | null {
  if (!value || value === ALL_MONTHS) return null;
  const d = new Date(value + "T00:00:00");
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function monthLabel(value: string) {
  if (!value || value === ALL_MONTHS) return "Todos los meses";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

interface MonthFilterProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  includeAll?: boolean;
  back?: number;
  forward?: number;
}

export function MonthFilter({ value, onChange, className = "w-[190px]", includeAll = true, back = 11, forward = 1 }: MonthFilterProps) {
  const months = monthList(back, forward);
  const extra = value !== ALL_MONTHS && !months.some((m) => m.value === value)
    ? [{ value, label: monthLabel(value) }]
    : [];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${className} h-9`}><SelectValue placeholder="Mes" /></SelectTrigger>
      <SelectContent className="max-h-72">
        {includeAll && <SelectItem value={ALL_MONTHS}>Todos los meses</SelectItem>}
        {[...extra, ...months].map((m) => (
          <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
