import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

export const CURRENCY_SYMBOL: Record<string, string> = {
  ARS: "$",
  EUR: "€",
};

export function formatMoney(amount: number | string | null | undefined, currency: string = "ARS") {
  const n = Number(amount ?? 0);
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  return `${sym}${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy", { locale: es });
}

export function daysOverdue(due: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function relative(d: string | Date) {
  return formatDistanceToNowStrict(new Date(d), { locale: es, addSuffix: true });
}

export function addDaysFromFrequency(freq: "weekly" | "biweekly" | "monthly", from = new Date()) {
  const d = new Date(from);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
