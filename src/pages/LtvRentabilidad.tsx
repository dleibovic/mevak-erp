import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { Info, DollarSign, Percent, Clock, TrendingUp } from "lucide-react";

type ClientRow = {
  id: string;
  company_name: string;
  country_id: string | null;
  assigned_executive_id: string | null;
  food_category_id: string | null;
  status: string;
  activated_at: string | null;
  churned_at: string | null;
  monthly_fee: number;
  fee_currency: string;
  cmv_cost: number;
  cmv_currency: string;
  discount_active: boolean;
  discount_percentage: number | null;
  discount_ends_at: string | null;
};

type CmhRow = {
  client_id: string;
  snapshot_month: string;
  mrr_amount: number;
  mrr_amount_usd: number | null;
  movement_type: string;
};

type RateRow = { base_currency: string; rate: number; rate_date: string; source: string };

function fmtUsd(n: number) {
  return `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtPct(n: number, d = 1) {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(d)}%`;
}
function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
}

export default function LtvRentabilidad() {
  const [country, setCountry] = useState("all");
  const [executive, setExecutive] = useState("all");
  const [foodCat, setFoodCat] = useState("all");
  const [currency, setCurrency] = useState("all");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-ltv"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, country_id, assigned_executive_id, food_category_id, status, activated_at, churned_at, monthly_fee, fee_currency, cmv_cost, cmv_currency, discount_active, discount_percentage, discount_ends_at");
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: cmh = [] } = useQuery({
    queryKey: ["cmh-ltv-24m"],
    queryFn: async () => {
      const oldest = lastNMonths(24)[0];
      const { data } = await (supabase as any)
        .from("client_mrr_history")
        .select("client_id, snapshot_month, mrr_amount, mrr_amount_usd, movement_type")
        .gte("snapshot_month", oldest);
      return (data ?? []) as CmhRow[];
    },
  });

  const { data: rates = [] } = useQuery({
    queryKey: ["latest-rates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("base_currency, rate, rate_date, source")
        .order("rate_date", { ascending: false });
      return (data ?? []) as RateRow[];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-12m"],
    queryFn: async () => {
      const cutoff = lastNMonths(12)[0];
      const { data } = await supabase
        .from("expenses")
        .select("amount, currency, date, category_id, assigned_to, expense_categories:category_id(name)")
        .gte("date", cutoff);
      return (data ?? []) as any[];
    },
  });

  const { data: countries = [] } = useQuery({
    queryKey: ["countries-list"],
    queryFn: async () => (await supabase.from("countries").select("id, name")).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name").eq("is_active", true)).data ?? [],
  });
  const { data: foodCategories = [] } = useQuery({
    queryKey: ["food-categories"],
    queryFn: async () => (await supabase.from("food_categories").select("id, name")).data ?? [],
  });

  // Latest rate per currency (canonical: units per 1 USD; divide to get USD)
  const latestRate = useMemo(() => {
    const m = new Map<string, number>();
    rates.forEach((r) => { if (!m.has(r.base_currency)) m.set(r.base_currency, Number(r.rate)); });
    return m;
  }, [rates]);

  const toUsd = (amount: number, ccy: string) => {
    if (!amount) return 0;
    if (ccy === "USD") return amount;
    const r = latestRate.get(ccy);
    if (!r || r === 0) return 0;
    return amount / r;
  };

  const currenciesAvailable = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => s.add(c.fee_currency));
    return Array.from(s).sort();
  }, [clients]);

  const filteredClients = useMemo(() => clients.filter((c) => {
    if (country !== "all" && c.country_id !== country) return false;
    if (executive !== "all" && c.assigned_executive_id !== executive) return false;
    if (foodCat !== "all" && c.food_category_id !== foodCat) return false;
    if (currency !== "all" && c.fee_currency !== currency) return false;
    return true;
  }), [clients, country, executive, foodCat, currency]);

  // CMH grouped by client
  const cmhByClient = useMemo(() => {
    const m = new Map<string, CmhRow[]>();
    cmh.forEach((r) => {
      if (!m.has(r.client_id)) m.set(r.client_id, []);
      m.get(r.client_id)!.push(r);
    });
    return m;
  }, [cmh]);

  // Per-client computed metrics
  type ClientMetric = {
    id: string;
    name: string;
    status: string;
    activeMonths: number;
    feeUsd: number;
    cmvUsd: number;
    marginPct: number;
    marginUsd: number;
    historicalLtvUsd: number;
  };

  const today = new Date();
  const perClient: ClientMetric[] = useMemo(() => {
    return filteredClients.map((c) => {
      const effectiveFee = c.discount_active && c.discount_percentage
        ? c.monthly_fee * (1 - Number(c.discount_percentage) / 100)
        : c.monthly_fee;
      const feeUsd = toUsd(Number(effectiveFee || 0), c.fee_currency);
      const cmvUsd = toUsd(Number(c.cmv_cost || 0), c.cmv_currency);
      const marginUsd = feeUsd - cmvUsd;
      const marginPct = feeUsd > 0 ? marginUsd / feeUsd : 0;

      const start = c.activated_at ? new Date(c.activated_at) : null;
      const end = c.churned_at ? new Date(c.churned_at) : today;
      const activeMonths = start
        ? Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1)
        : 0;

      const rows = cmhByClient.get(c.id) ?? [];
      const historicalLtvUsd = rows.reduce((s, r) => {
        if (r.movement_type === "churn") return s;
        return s + Number(r.mrr_amount_usd || 0);
      }, 0);

      return {
        id: c.id, name: c.company_name, status: c.status, activeMonths,
        feeUsd, cmvUsd, marginPct, marginUsd, historicalLtvUsd,
      };
    });
  }, [filteredClients, cmhByClient, latestRate]);

  // Aggregates
  const active = perClient.filter((p) => p.status === "active");
  const totalMrrUsd = active.reduce((s, p) => s + p.feeUsd, 0);
  const totalCmvUsd = active.reduce((s, p) => s + p.cmvUsd, 0);
  const grossMarginPct = totalMrrUsd > 0 ? (totalMrrUsd - totalCmvUsd) / totalMrrUsd : 0;
  const arpa = active.length > 0 ? totalMrrUsd / active.length : 0;

  // Logo churn 12m for LTV denominator (from cmh)
  const months12 = useMemo(() => lastNMonths(12), []);
  const { churned12, base12 } = useMemo(() => {
    const filteredIds = new Set(filteredClients.map((c) => c.id));
    const churnEvents = cmh.filter((r) => r.movement_type === "churn" && filteredIds.has(r.client_id) && r.snapshot_month >= months12[0]);
    const baseMonth = months12[0];
    const baseActive = new Set<string>();
    cmh.forEach((r) => {
      if (r.snapshot_month === baseMonth && r.movement_type !== "churn" && r.mrr_amount > 0 && filteredIds.has(r.client_id)) {
        baseActive.add(r.client_id);
      }
    });
    return { churned12: churnEvents.length, base12: baseActive.size };
  }, [cmh, filteredClients, months12]);

  const annualLogoChurn = base12 > 0 ? Math.min(1, churned12 / base12) : 0;
  const ltvSimple = annualLogoChurn > 0 ? (arpa * 12) / annualLogoChurn : 0;
  const ltvMargin = ltvSimple * grossMarginPct;

  // CAC approx: marketing + sales-related expenses last 12m / new clients last 12m
  const cacInputs = useMemo(() => {
    const acqExpensesUsd = expenses.reduce((s, e) => {
      const catName = e.expense_categories?.name || "";
      const isAcq = ["Marketing", "Sueldos extra"].includes(catName); // approximation
      if (!isAcq) return s;
      return s + toUsd(Number(e.amount || 0), e.currency);
    }, 0);
    const newClientsCount = filteredClients.filter((c) => {
      if (!c.activated_at) return false;
      return c.activated_at >= months12[0];
    }).length;
    return { acqExpensesUsd, newClientsCount };
  }, [expenses, filteredClients, months12, latestRate]);

  const cac = cacInputs.newClientsCount > 0 ? cacInputs.acqExpensesUsd / cacInputs.newClientsCount : 0;
  const ltvCacRatio = cac > 0 ? ltvMargin / cac : 0;
  const paybackMonths = arpa > 0 && grossMarginPct > 0 ? cac / (arpa * grossMarginPct) : 0;

  // Margin distribution buckets
  const marginBuckets = useMemo(() => {
    const buckets = [
      { range: "<0%", min: -Infinity, max: 0, count: 0 },
      { range: "0-25%", min: 0, max: 0.25, count: 0 },
      { range: "25-50%", min: 0.25, max: 0.5, count: 0 },
      { range: "50-75%", min: 0.5, max: 0.75, count: 0 },
      { range: "75-100%", min: 0.75, max: 1.01, count: 0 },
    ];
    active.forEach((p) => {
      const b = buckets.find((x) => p.marginPct >= x.min && p.marginPct < x.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [active]);

  // Scatter LTV vs margin
  const scatterData = active.map((p) => ({
    x: p.marginPct * 100,
    y: p.historicalLtvUsd,
    z: p.feeUsd,
    name: p.name,
  }));

  // Top / bottom by margin
  const topMargin = [...active].sort((a, b) => b.marginUsd - a.marginUsd).slice(0, 10);
  const bottomMargin = [...active].filter((p) => p.feeUsd > 0).sort((a, b) => a.marginPct - b.marginPct).slice(0, 10);

  return (
    <PageContainer>
      <PageHeader
        title="LTV & Rentabilidad"
        description="Margen bruto, LTV histórico y simple, CAC aproximado y ratios de eficiencia"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-44"><SelectValue placeholder="País" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los países</SelectItem>
            {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={executive} onValueChange={setExecutive}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los ejecutivos</SelectItem>
            {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={foodCat} onValueChange={setFoodCat}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {foodCategories.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Moneda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las monedas</SelectItem>
            {currenciesAvailable.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-3 border-amber-500/40 bg-amber-500/5 flex items-start gap-2 text-sm">
        <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <strong>CMV en USD</strong> se convierte con el tipo de cambio canónico más reciente (sin histórico de CMV).
          <strong> CAC</strong> es aproximado: suma de gastos "Marketing" + "Sueldos extra" últimos 12m / altas últimos 12m
          — para un CAC preciso se requiere tracking dedicado de costos de adquisición por cliente.
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="MRR activo (USD)" value={fmtUsd(totalMrrUsd)} sub={`${active.length} clientes activos`} />
        <KpiCard icon={<Percent className="h-4 w-4" />} label="Margen bruto agregado" value={fmtPct(grossMarginPct)} sub={`CMV ${fmtUsd(totalCmvUsd)}`} />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="ARPA (USD)" value={fmtUsd(arpa)} sub="por cliente activo" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Logo Churn anual" value={fmtPct(annualLogoChurn)} sub={`${churned12} / base ${base12}`} />
        <KpiCard label="LTV simple" value={fmtUsd(ltvSimple)} sub="ARPA·12 / churn anual" />
        <KpiCard label="LTV con margen" value={fmtUsd(ltvMargin)} sub={`LTV·${fmtPct(grossMarginPct, 0)}`} tone="primary" />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="CAC aprox." value={fmtUsd(cac)} sub={`${fmtUsd(cacInputs.acqExpensesUsd)} / ${cacInputs.newClientsCount} altas`} />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="LTV/CAC · Payback" value={`${ltvCacRatio.toFixed(1)}x · ${paybackMonths > 0 ? paybackMonths.toFixed(1) + "m" : "—"}`} sub="ratio y meses para recuperar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="font-semibold mb-1">Distribución de margen bruto</div>
          <div className="text-xs text-muted-foreground mb-3">Clientes activos por bucket de margen %</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginBuckets}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {marginBuckets.map((b, i) => (
                    <Cell key={i} fill={i === 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-1">LTV histórico vs margen</div>
          <div className="text-xs text-muted-foreground mb-3">Cada punto es un cliente activo (tamaño = MRR USD)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="x" name="Margen %" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <YAxis dataKey="y" name="LTV USD" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <ZAxis dataKey="z" range={[40, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: any, n: any) => n === "Margen %" ? `${Number(v).toFixed(1)}%` : fmtUsd(Number(v))}
                  labelFormatter={(_, p: any) => p?.[0]?.payload?.name ?? ""}
                />
                <Scatter data={scatterData} fill="hsl(var(--primary))" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top / bottom tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ClientRankTable title="Top 10 — Margen USD" rows={topMargin} mode="top" />
        <ClientRankTable title="Bottom 10 — Margen %" rows={bottomMargin} mode="bottom" />
      </div>

      {/* Full table */}
      <Card className="p-4">
        <div className="font-semibold mb-3">Detalle por cliente (activos)</div>
        <div className="overflow-x-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Meses</TableHead>
                <TableHead className="text-right">MRR USD</TableHead>
                <TableHead className="text-right">CMV USD</TableHead>
                <TableHead className="text-right">Margen USD</TableHead>
                <TableHead className="text-right">Margen %</TableHead>
                <TableHead className="text-right">LTV hist.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perClient
                .sort((a, b) => b.feeUsd - a.feeUsd)
                .map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{p.activeMonths}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(p.feeUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(p.cmvUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(p.marginUsd)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${p.marginPct < 0 ? "text-destructive" : ""}`}>
                      {fmtPct(p.marginPct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(p.historicalLtvUsd)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </PageContainer>
  );
}

function ClientRankTable({ title, rows, mode }: { title: string; rows: any[]; mode: "top" | "bottom" }) {
  return (
    <Card className="p-4">
      <div className="font-semibold mb-3">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">MRR</TableHead>
            <TableHead className="text-right">Margen</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="max-w-[180px] truncate">{p.name}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtUsd(p.feeUsd)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtUsd(p.marginUsd)}</TableCell>
              <TableCell className={`text-right tabular-nums ${p.marginPct < 0 ? "text-destructive" : ""}`}>
                {fmtPct(p.marginPct)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function KpiCard({
  icon, label, value, sub, tone,
}: { icon?: React.ReactNode; label: string; value: string; sub?: string; tone?: "primary" | "destructive" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
