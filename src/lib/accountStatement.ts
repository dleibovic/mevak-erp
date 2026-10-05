export type StmtInvoice = {
  id?: string;
  period_month: string;
  invoice_date?: string | null;
  due_date?: string | null;
  amount: number | string;
  amount_paid?: number | string | null;
  currency: string;
  status?: string;
  paid_at?: string | null;
  sub_brand_id?: string | null;
  voided_at?: string | null;
  incobrable_at?: string | null;
  payment_channel?: string | null;
};

export type StmtState =
  | "Anulada" | "Incobrable" | "Pagada"
  | "Vencida" | "Vencida (pago parcial)"
  | "A vencer" | "A vencer (pago parcial)";

export type StmtTone = "paid" | "overdue" | "pending" | "incobrable" | "void";

export function stateTone(s: StmtState): StmtTone {
  if (s === "Pagada") return "paid";
  if (s.startsWith("Vencida")) return "overdue";
  if (s.startsWith("A vencer")) return "pending";
  if (s === "Incobrable") return "incobrable";
  return "void";
}

export function todayISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function evalInvoice(inv: StmtInvoice, today = todayISO()): { state: StmtState; saldo: number } {
  const amount = Number(inv.amount || 0);
  const paid = Number(inv.amount_paid || 0);
  if (inv.voided_at && !inv.incobrable_at) return { state: "Anulada", saldo: 0 };
  if (inv.incobrable_at) return { state: "Incobrable", saldo: amount - paid };
  const saldo = amount - paid;
  if (saldo <= 0) return { state: "Pagada", saldo: 0 };
  const due = (inv.due_date ?? "").slice(0, 10);
  if (due && due < today) return { state: paid > 0 ? "Vencida (pago parcial)" : "Vencida", saldo };
  return { state: paid > 0 ? "A vencer (pago parcial)" : "A vencer", saldo };
}

export type StmtTotals = { facturado: number; cobrado: number; aVencer: number; vencido: number; incobrable: number; saldoTotal: number };

export function totalsByCurrency(invs: StmtInvoice[], today = todayISO()): Record<string, StmtTotals> {
  const out: Record<string, StmtTotals> = {};
  for (const inv of invs) {
    const { state, saldo } = evalInvoice(inv, today);
    if (state === "Anulada") continue;
    const t = (out[inv.currency] ??= { facturado: 0, cobrado: 0, aVencer: 0, vencido: 0, incobrable: 0, saldoTotal: 0 });
    t.facturado += Number(inv.amount || 0);
    t.cobrado += Number(inv.amount_paid || 0);
    if (state === "Incobrable") t.incobrable += saldo;
    else if (state.startsWith("A vencer")) t.aVencer += saldo;
    else if (state.startsWith("Vencida")) t.vencido += saldo;
  }
  for (const t of Object.values(out)) t.saldoTotal = t.aVencer + t.vencido;
  return out;
}

const SYM: Record<string, string> = { ARS: "$", EUR: "€", USD: "US$" };
export function money(n: number, cur: string) {
  return `${SYM[cur] ?? cur + " "}${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fmtPeriod(p?: string | null) {
  if (!p) return "—";
  const [y, m] = p.slice(0, 10).split("-");
  return `${MES[Number(m) - 1]} ${y}`;
}
export function fmtDMY(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
