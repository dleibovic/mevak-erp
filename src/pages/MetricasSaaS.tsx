import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info, Coins } from "lucide-react";
import { fmtDisplay, getDisplayCurrency, getDisplayCountryName } from "@/lib/displayCurrency";

type CmhRow = {
  client_id: string;
  snapshot_month: string;
  currency: string;
  mrr_amount: number;
  mrr_amount_usd: number | null;
  movement_type: "new" | "expansion" | "contraction" | "churn" | "reactivation" | "currency_switch";
  previous_mrr: number | null;
  delta: number | null;
  is_estimated: boolean;
};

type ClientLite = {
  id: string;
  company_name: string;
  country_id: string | null;
  assigned_executive_id: string | null;
  food_category_id: string | null;
  fee_currency: string;
};

function fmtPct(n: number, digits = 1) {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}
function monthKey(d: string) { return d.slice(0, 7); }
function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
}

export default function MetricasSaaS() {
  const [country, setCountry] = useState<string>("all");
  const [executive, setExecutive] = useState<string>("all");
  const [foodCat, setFoodCat] = useState<string>("all");
  const [currency, setCurrency] = useState<string>("all");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-lite"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, country_id, assigned_executive_id, food_category_id, fee_currency");
      return (data ?? []) as ClientLite[];
    },
  });

  const { data: cmh = [] } = useQuery({
    queryKey: ["cmh-24m"],
    queryFn: async () => {
      const oldest = lastNMonths(24)[0];
      const { data } = await (supabase as any)
        .from("client_mrr_history")
        .select("client_id, snapshot_month, currency, mrr_amount, mrr_amount_usd, movement_type, previous_mrr, delta, is_estimated")
        .gte("snapshot_month", oldest)
        .order("snapshot_month", { ascending: true });
      return (data ?? []) as CmhRow[];
    },
  });

  const { data: countries = [] } = useQuery({
    queryKey: ["countries-cc"],
    queryFn: async () => (await supabase.from("countries").select("id, name, currency_code")).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name").eq("is_active", true)).data ?? [],
  });
  const { data: foodCategories = [] } = useQuery({
    queryKey: ["food-categories"],
    queryFn: async () => (await supabase.from("food_categories").select("id, name")).data ?? [],
  });
  const { data: rates = [] } = useQuery({
    queryKey: ["latest-rates"],
    queryFn: async () => (await supabase.from("exchange_rates").select("base_currency, rate, rate_date").order("rate_date", { ascending: false })).data ?? [],
  });

  const latestRate = useMemo(() => {
    const m = new Map<string, number>();
    (rates as any[]).forEach((r) => { if (!m.has(r.base_currency)) m.set(r.base_currency, Number(r.rate)); });
    return m;
  }, [rates]);

  const displayCurrency = getDisplayCurrency(country, countries as any);
  const displayCountryName = getDisplayCountryName(country, countries as any);
  const fmtMoney = (usd: number) => fmtDisplay(usd, displayCurrency, latestRate);

  const clientById = useMemo(() => {
    const m = new Map<string, ClientLite>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const currenciesAvailable = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => s.add(c.fee_currency));
    return Array.from(s).sort();
  }, [clients]);

  // Filter cmh by client attributes
  const filteredCmh = useMemo(() => {
    return cmh.filter((r) => {
      const c = clientById.get(r.client_id);
      if (!c) return false;
      if (country !== "all" && c.country_id !== country) return false;
      if (executive !== "all" && c.assigned_executive_id !== executive) return false;
      if (foodCat !== "all" && c.food_category_id !== foodCat) return false;
      if (currency !== "all" && c.fee_currency !== currency) return false;
      return true;
    });
  }, [cmh, clientById, country, executive, foodCat, currency]);

  const months = useMemo(() => lastNMonths(24), []);

  // Aggregate per month from filtered cmh
  const monthly = useMemo(() => {
    type Agg = {
      month: string;
      mrr: number;
      activeClients: number;
      newMrr: number;
      expansionMrr: number;
      reactivationMrr: number;
      contractionMrr: number;
      churnMrr: number;
      logoChurnCount: number;
      logoBaseCount: number;
      mrrBase: number;
      mrrChurnedRevenue: number;
      estimated: boolean;
    };
    const map = new Map<string, Agg>();
    months.forEach((m) => map.set(m, {
      month: m, mrr: 0, activeClients: 0, newMrr: 0, expansionMrr: 0, reactivationMrr: 0,
      contractionMrr: 0, churnMrr: 0, logoChurnCount: 0, logoBaseCount: 0, mrrBase: 0,
      mrrChurnedRevenue: 0, estimated: false,
    }));

    // Previous-month active counts for churn base
    const activeByMonth = new Map<string, Set<string>>();
    months.forEach((m) => activeByMonth.set(m, new Set()));

    filteredCmh.forEach((r) => {
      const agg = map.get(r.snapshot_month);
      if (!agg) return;
      const usd = Number(r.mrr_amount_usd || 0);
      if (r.movement_type !== "churn" && r.mrr_amount > 0) {
        agg.mrr += usd;
        activeByMonth.get(r.snapshot_month)!.add(r.client_id);
      }
      if (r.is_estimated) agg.estimated = true;
      switch (r.movement_type) {
        case "new": agg.newMrr += usd; break;
        case "expansion":
          if ((r.delta ?? 0) > 0) {
            // approximate USD delta proportionally
            const ratio = r.mrr_amount > 0 ? usd / r.mrr_amount : 0;
            agg.expansionMrr += (r.delta ?? 0) * ratio;
          }
          break;
        case "reactivation": agg.reactivationMrr += usd; break;
        case "contraction": {
          const ratio = r.mrr_amount > 0 ? usd / r.mrr_amount : 0;
          agg.contractionMrr += Math.abs((r.delta ?? 0) * ratio);
          break;
        }
        case "churn":
          agg.churnMrr += Math.abs(r.delta ?? 0) * 0; // delta in local; compute in USD below
          break;
      }
    });

    // Compute churn USD using previous month's USD baseline per client
    const usdByMonthClient = new Map<string, Map<string, number>>();
    filteredCmh.forEach((r) => {
      if (!usdByMonthClient.has(r.snapshot_month)) usdByMonthClient.set(r.snapshot_month, new Map());
      if (r.movement_type !== "churn" && r.mrr_amount > 0) {
        usdByMonthClient.get(r.snapshot_month)!.set(r.client_id, Number(r.mrr_amount_usd || 0));
      }
    });
    filteredCmh.forEach((r) => {
      if (r.movement_type !== "churn") return;
      const agg = map.get(r.snapshot_month);
      if (!agg) return;
      const prevMonth = months[months.indexOf(r.snapshot_month) - 1];
      const prevUsd = prevMonth ? (usdByMonthClient.get(prevMonth)?.get(r.client_id) ?? 0) : 0;
      agg.churnMrr += prevUsd;
      agg.logoChurnCount += 1;
    });

    // active clients + logo base (previous month active set)
    months.forEach((m, idx) => {
      const agg = map.get(m)!;
      agg.activeClients = activeByMonth.get(m)!.size;
      const prev = idx > 0 ? months[idx - 1] : null;
      agg.logoBaseCount = prev ? activeByMonth.get(prev)!.size : 0;
      agg.mrrBase = prev ? (map.get(prev)!.mrr) : 0;
      agg.mrrChurnedRevenue = agg.churnMrr;
    });

    return months.map((m) => map.get(m)!);
  }, [filteredCmh, months]);

  // Current month metrics
  const currentIdx = monthly.length - 1;
  const cur = monthly[currentIdx];
  const prev = monthly[currentIdx - 1];
  const mrrDelta = prev && prev.mrr > 0 ? (cur.mrr - prev.mrr) / prev.mrr : 0;
  const activeDelta = (cur?.activeClients ?? 0) - (prev?.activeClients ?? 0);
  const arr = (cur?.mrr ?? 0) * 12;

  const logoChurnMonth = cur && cur.logoBaseCount > 0 ? cur.logoChurnCount / cur.logoBaseCount : 0;
  const last3 = monthly.slice(-3);
  const logoChurnQ = (() => {
    const churned = last3.reduce((s, m) => s + m.logoChurnCount, 0);
    const base = last3[0]?.logoBaseCount ?? 0;
    return base > 0 ? churned / base : 0;
  })();

  // NRR (last 12m): (MRR base + Expansion + Reactivation - Contraction - Churn) / MRR base
  const last12 = monthly.slice(-12);
  const nrr = (() => {
    const baseM = last12[0];
    if (!baseM || baseM.mrr === 0) return 0;
    const exp = last12.reduce((s, m) => s + m.expansionMrr, 0);
    const reac = last12.reduce((s, m) => s + m.reactivationMrr, 0);
    const con = last12.reduce((s, m) => s + m.contractionMrr, 0);
    const ch = last12.reduce((s, m) => s + m.churnMrr, 0);
    return (baseM.mrr + exp + reac - con - ch) / baseM.mrr;
  })();

  // LTV simple = ARPA / logo churn (annualized)
  const arpa = cur && cur.activeClients > 0 ? cur.mrr / cur.activeClients : 0;
  const annualLogoChurn = Math.min(1, logoChurnMonth * 12);
  const ltvSimple = annualLogoChurn > 0 ? (arpa * 12) / annualLogoChurn : 0;

  // Estimated flag for chart
  const hasEstimated = monthly.some((m) => m.estimated);
  const firstNonEstimated = monthly.find((m) => !m.estimated)?.month;

  const chartData = monthly.map((m) => ({
    month: m.month.slice(0, 7),
    New: Math.round(m.newMrr),
    Expansion: Math.round(m.expansionMrr),
    Reactivation: Math.round(m.reactivationMrr),
    Contraction: -Math.round(m.contractionMrr),
    Churn: -Math.round(m.churnMrr),
    MRR: Math.round(m.mrr),
  }));

  const churnLineData = monthly.map((m) => ({
    month: m.month.slice(0, 7),
    logoChurn: m.logoBaseCount > 0 ? (m.logoChurnCount / m.logoBaseCount) * 100 : 0,
    revenueChurn: m.mrrBase > 0 ? (m.mrrChurnedRevenue / m.mrrBase) * 100 : 0,
  }));

  // Movements table for current month
  const currentMonthMovements = useMemo(() => {
    const m = months[months.length - 1];
    const rows = filteredCmh.filter((r) => r.snapshot_month === m && r.movement_type !== "currency_switch");
    return rows
      .map((r) => ({
        client: clientById.get(r.client_id)?.company_name ?? "—",
        movement: r.movement_type,
        mrr_usd: Number(r.mrr_amount_usd || 0),
        delta: Number(r.delta || 0),
        currency: r.currency,
      }))
      .sort((a, b) => b.mrr_usd - a.mrr_usd);
  }, [filteredCmh, months, clientById]);

  return (
    <PageContainer>
      <PageHeader
        title="Métricas SaaS"
        description="MRR, churn, NRR y LTV — últimos 24 meses. Snapshots calculados desde activated_at por cliente."
      />

      {/* Filters */}
      <Card className="p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3 bg-gradient-card border-border/60">
        <FilterSelect label="País" value={country} onChange={setCountry}
          options={[{ value: "all", label: "Todos" }, ...countries.map((c: any) => ({ value: c.id, label: c.name }))]} />
        <FilterSelect label="Ejecutivo" value={executive} onChange={setExecutive}
          options={[{ value: "all", label: "Todos" }, ...employees.map((e: any) => ({ value: e.id, label: e.full_name }))]} />
        <FilterSelect label="Tipo (food category)" value={foodCat} onChange={setFoodCat}
          options={[{ value: "all", label: "Todos" }, ...foodCategories.map((f: any) => ({ value: f.id, label: f.name }))]} />
        <FilterSelect label="Moneda original" value={currency} onChange={setCurrency}
          options={[{ value: "all", label: "Todas" }, ...currenciesAvailable.map((c) => ({ value: c, label: c }))]} />
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="MRR actual" value={fmtMoney(cur?.mrr ?? 0)}
          delta={mrrDelta} sub={`vs mes anterior`} />
        <Kpi label="ARR" value={fmtMoney(arr)} sub="MRR × 12" />
        <Kpi label="Clientes activos" value={String(cur?.activeClients ?? 0)}
          delta={null} sub={`${activeDelta >= 0 ? "+" : ""}${activeDelta} vs mes anterior`}
          subAccent={activeDelta >= 0 ? "pos" : "neg"} />
        <Kpi label="Logo Churn mensual" value={fmtPct(logoChurnMonth)} sub={`${cur?.logoChurnCount ?? 0} bajas sobre base ${cur?.logoBaseCount ?? 0}`} />
        <Kpi label="Logo Churn trimestral" value={fmtPct(logoChurnQ)} sub="rolling 3 meses" />
        <Kpi label="NRR (12m)" value={fmtPct(nrr)} sub="net revenue retention" />
        <Kpi label="LTV simple" value={fmtMoney(ltvSimple)} sub="ARPA / churn anual" />
        <Kpi label="LTV con margen" value="—" sub="requiere time tracking" muted />
      </div>

      {hasEstimated && firstNonEstimated && (
        <div className="flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-md p-3 mb-5">
          <AlertTriangle className="h-4 w-4" />
          Snapshots históricos estimados — descomposición por movement_type no disponible antes de {firstNonEstimated.slice(0, 7)}.
        </div>
      )}

      {/* Main MRR chart */}
      <Card className="p-4 mb-6 bg-gradient-card border-border/60">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold">Evolución de MRR (USD) — últimos 24 meses</h3>
            <p className="text-xs text-muted-foreground">Barras apiladas por componente · línea = MRR total</p>
          </div>
        </div>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} width={70} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="New" stackId="up" fill="hsl(142 70% 45%)" />
              <Bar dataKey="Expansion" stackId="up" fill="hsl(160 70% 40%)" />
              <Bar dataKey="Reactivation" stackId="up" fill="hsl(190 70% 45%)" />
              <Bar dataKey="Contraction" stackId="down" fill="hsl(35 80% 55%)" />
              <Bar dataKey="Churn" stackId="down" fill="hsl(0 75% 55%)" />
              <Line type="monotone" dataKey="MRR" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Churn chart */}
      <Card className="p-4 mb-6 bg-gradient-card border-border/60">
        <h3 className="font-semibold mb-2">Logo Churn % vs Revenue Churn %</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={churnLineData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} width={50} />
              <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="logoChurn" name="Logo Churn %" stroke="hsl(0 75% 55%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revenueChurn" name="Revenue Churn %" stroke="hsl(25 90% 55%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Current month movements */}
      <Card className="p-4 bg-gradient-card border-border/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Movimientos del mes en curso ({months[months.length - 1].slice(0, 7)})</h3>
          <Badge variant="outline" className="text-xs">{currentMonthMovements.length} clientes</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead className="text-right">MRR USD</TableHead>
                <TableHead className="text-right">Δ (local)</TableHead>
                <TableHead>Moneda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentMonthMovements.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Sin movimientos.</TableCell></TableRow>
              )}
              {currentMonthMovements.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.client}</TableCell>
                  <TableCell><MovementBadge type={r.movement} /></TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(r.mrr_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.delta.toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-xs">{r.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </PageContainer>
  );
}

function Kpi({ label, value, delta, sub, subAccent, muted }: {
  label: string; value: string; delta?: number | null; sub?: string;
  subAccent?: "pos" | "neg"; muted?: boolean;
}) {
  return (
    <Card className={`p-4 bg-gradient-card border-border/60 ${muted ? "opacity-60" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {delta != null && (
        <div className={`text-xs flex items-center gap-1 mt-1 ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
          {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {fmtPct(Math.abs(delta), 1)}
        </div>
      )}
      {sub && (
        <div className={`text-xs mt-1 ${subAccent === "pos" ? "text-emerald-500" : subAccent === "neg" ? "text-red-500" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function MovementBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "New", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    expansion: { label: "Expansion", cls: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
    reactivation: { label: "Reactivation", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
    contraction: { label: "Contraction", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    churn: { label: "Churn", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  };
  const cfg = map[type] ?? { label: type, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
