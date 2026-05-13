export const PAYMENT_CHANNEL_OPTIONS = [
  { value: "stripe_dario", label: "Stripe Darío" },
  { value: "us_dario", label: "US Darío" },
  { value: "maria_transferencia", label: "María Transferencia" },
  { value: "maria_efectivo", label: "María Efectivo" },
  { value: "dario_transferencia", label: "Darío Transferencia" },
  { value: "dario_efectivo", label: "Darío Efectivo" },
] as const;

export type PaymentChannel = typeof PAYMENT_CHANNEL_OPTIONS[number]["value"];

export const PAYMENT_CHANNEL_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_CHANNEL_OPTIONS.map((o) => [o.value, o.label]),
);

export const DISCOUNT_DURATION_OPTIONS = [
  { value: "30_days", label: "30 días", days: 30 },
  { value: "60_days", label: "60 días", days: 60 },
  { value: "90_days", label: "90 días", days: 90 },
  { value: "custom", label: "A definir", days: null as number | null },
] as const;

export const PRICE_CHANGE_LABEL: Record<string, string> = {
  increase: "Aumento",
  decrease: "Disminución",
  discount_applied: "Descuento aplicado",
  discount_expired: "Descuento vencido",
  manual_adjustment: "Ajuste manual",
};

export function addDaysISO(days: number, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
