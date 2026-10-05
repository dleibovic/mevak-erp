export type PartnerDebtMovement = {
  id: string;
  ledger: string;
  amount_usd: number;
  entry_type: string;
  entry_date: string;
  created_at: string;
  concept: string | null;
  origin_period: string | null;
  origin_rate_ars: number | null;
  amount_ars_origin: number | null;
};

export function debtBalances(rows: PartnerDebtMovement[]) {
  const balances = { meri: 0, empresa: 0 };
  const movements = [...rows]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((row) => {
      const ledger = row.ledger === "meri" ? "meri" : "empresa";
      balances[ledger] += Number(row.amount_usd);
      return { ...row, runningBalance: balances[ledger] };
    });
  return { balances, movements };
}

export function paymentInUsd(amount: number, currency: "USD" | "ARS", rate: number) {
  return currency === "USD" ? amount : amount / rate;
}

export function originMonth(date: string | null) {
  if (!date) return "—";
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return "—";
  return new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}