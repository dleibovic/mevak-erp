import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Info, TrendingDown, Users, Activity, Sparkles, Coins } from "lucide-react";
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
  activated_at: string | null;
  churned_at: string | null;
  status: string;
};

type ChurnEvent = {
  id: string;
  client_id: string;
  churned_at: string;
  reason_code: string;
  reason_detail: string | null;
  mrr_lost: number;
  mrr_lost_usd: number | null;
  currency: string;
};

const REASON_LABEL: Record<string, string> = {
  manual: "Manual",
  paused_timeout: "Pausa > umbral",
  non_payment: "No pago",
  dissatisfied: "Insatisfacción",
  price: "Precio",
  competitor: "Competidor",
  closed_business: "Cierre del negocio",
  other: "Otro",
};

const REASON_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 270 60% 60%))",
  "hsl(var(--chart-5, 160 60% 45%))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
];

// fmtMoney bound inside component (uses display currency)

function fmtPct(n: number, digits = 1) {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
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

export default function Churn() {
  const [country, setCountry] = useState("all");
  const [executive, setExecutive] = useState("all");
  const [foodCat, setFoodCat] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [period, setPeriod] = useState<"1m" | "3m" | "12m">("3m");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-lite-churn"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, country_id, assigned_executive_id, food_category_id, fee_currency, activated_at, churned_at, status");
      return (data ?? []) as ClientLite[];
    },
  });

  const { data: cmh = [] } = useQuery({
    queryKey: ["cmh-24m-churn"],
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

  const { data: churnEvents = [] } = useQuery({
    queryKey: ["churn-events-24m"],
    queryFn: async () => {
      const oldest = lastNMonths(24)[0];
      const { data } = await supabase
        .from("churn_events")
        .select("id, client_id, churned_at, reason_code, reason_detail, mrr_lost, mrr_lost_usd, currency")
        .gte("churned_at", oldest)
        .order("churned_at", { ascending: false });
      return (data ?? []) as ChurnEvent[];
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

  const passFilter = (clientId: string) => {
    const c = clientById.get(clientId);
    if (!c) return false;
    if (country !== "all" && c.country_id !== country) return false;
    if (executive !== "all" && c.assigned_executive_id !== executive) return false;
    if (foodCat !== "all" && c.food_category_id !== foodCat) return false;
    if (currency !== "all" && c.fee_currency !== currency) return false;
    return true;
  };

  const filteredCmh = useMemo(() => cmh.filter((r) => passFilter(r.client_id)), [cmh, clientById, country, executive, foodCat, currency]);
  const filteredEvents = useMemo(() => churnEvents.filter((e) => passFilter(e.client_id)), [churnEvents, clientById, country, executive, foodCat, currency]);

  const months = useMemo(() => lastNMonths(24), []);

  // Per-month aggregates
  const monthly = useMemo(() => {
    type Agg = {
      month: string;
      activeClients: number;
      logoChurnCount: number;
      logoBaseCount: number;
      mrrBase: number;
      churnMrr: number;
      estimated: boolean;
    };
    const map = new Map<string, Agg>();
    months.forEach((m) => map.set(m, {
      month: m, activeClients: 0, logoChurnCount: 0, logoBaseCount: 0,
      mrrBase: 0, churnMrr: 0, estimated: false,
    }));

    const activeByMonth = new Map<string, Set<string>>();
    const mrrByMonth = new Map<string, number>();
    const usdByMonthClient = new Map<string, Map<string, number>>();
    months.forEach((m) => { activeByMonth.set(m, new Set()); mrrByMonth.set(m, 0); usdByMonthClient.set(m, new Map()); });

    filteredCmh.forEach((r) => {
      const agg = map.get(r.snapshot_month);
      if (!agg) return;
      if (r.is_estimated) agg.estimated = true;
      const usd = Number(r.mrr_amount_usd || 0);
      if (r.movement_type !== "churn" && r.mrr_amount > 0) {
        activeByMonth.get(r.snapshot_month)!.add(r.client_id);
        mrrByMonth.set(r.snapshot_month, (mrrByMonth.get(r.snapshot_month) || 0) + usd);
        usdByMonthClient.get(r.snapshot_month)!.set(r.client_id, usd);
      }
    });

    filteredCmh.forEach((r) => {
      if (r.movement_type !== "churn") return;
      const agg = map.get(r.snapshot_month);
      if (!agg) return;
      const idx = months.indexOf(r.snapshot_month);
      const prev = idx > 0 ? months[idx - 1] : null;
      const prevUsd = prev ? (usdByMonthClient.get(prev)?.get(r.client_id) ?? 0) : 0;
      agg.churnMrr += prevUsd;
      agg.logoChurnCount += 1;
    });

    months.forEach((m, idx) => {
      const agg = map.get(m)!;
      agg.activeClients = activeByMonth.get(m)!.size;
      const prev = idx > 0 ? months[idx - 1] : null;
      agg.logoBaseCount = prev ? activeByMonth.get(prev)!.size : 0;
      agg.mrrBase = prev ? (mrrByMonth.get(prev) || 0) : 0;
    });

    return months.map((m) => map.get(m)!);
  }, [filteredCmh, months]);

  const currentIdx = monthly.length - 1;
  const cur = monthly[currentIdx];
  const last3 = monthly.slice(-3);
  const last12 = monthly.slice(-12);

  const logoChurnMonth = cur && cur.logoBaseCount > 0 ? cur.logoChurnCount / cur.logoBaseCount : 0;
  const revChurnMonth = cur && cur.mrrBase > 0 ? cur.churnMrr / cur.mrrBase : 0;

  const logoChurnQ = (() => {
    const churned = last3.reduce((s, m) => s + m.logoChurnCount, 0);
    const base = last3[0]?.logoBaseCount ?? 0;
    return base > 0 ? churned / base : 0;
  })();
  const revChurnQ = (() => {
    const churned = last3.reduce((s, m) => s + m.churnMrr, 0);
    const base = last3[0]?.mrrBase ?? 0;
    return base > 0 ? churned / base : 0;
  })();

  const logoChurn12 = (() => {
    const churned = last12.reduce((s, m) => s + m.logoChurnCount, 0);
    const base = last12[0]?.logoBaseCount ?? 0;
    return base > 0 ? churned / base : 0;
  })();

  const churnedLastMonthCount = cur?.logoChurnCount ?? 0;
  const mrrLostLastMonth = cur?.churnMrr ?? 0;

  // Period filter for reasons + table
  const periodMonths = period === "1m" ? 1 : period === "3m" ? 3 : 12;
  const periodCutoff = months[months.length - periodMonths];
  const eventsInPeriod = useMemo(
    () => filteredEvents.filter((e) => e.churned_at >= periodCutoff),
    [filteredEvents, periodCutoff],
  );

  const reasonBreakdown = useMemo(() => {
    const m = new Map<string, { reason: string; count: number; mrrUsd: number }>();
    eventsInPeriod.forEach((e) => {
      const k = e.reason_code;
      if (!m.has(k)) m.set(k, { reason: k, count: 0, mrrUsd: 0 });
      const row = m.get(k)!;
      row.count += 1;
      row.mrrUsd += Number(e.mrr_lost_usd || 0);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [eventsInPeriod]);

  // Chart data
  const churnSeries = monthly.map((m) => ({
    month: m.month.slice(0, 7),
    logoChurn: m.logoBaseCount > 0 ? (m.logoChurnCount / m.logoBaseCount) * 100 : 0,
    revenueChurn: m.mrrBase > 0 ? (m.churnMrr / m.mrrBase) * 100 : 0,
    mrrLost: Math.round(m.churnMrr),
    logos: m.logoChurnCount,
    estimated: m.estimated,
  }));

  const hasEstimated = monthly.some((m) => m.estimated);
  const hasAnyData = filteredCmh.length > 0 || filteredEvents.length > 0;

  // Cohort retention: rows = cohort month (alta), cols = months elapsed
  const cohort = useMemo(() => {
    const COHORT_MONTHS = 12;
    const ELAPSED = 12;
    const cohortKeys = lastNMonths(COHORT_MONTHS); // oldest -> newest

    const now = new Date();
    const curMonthIdx = now.getFullYear() * 12 + now.getMonth();
    const monthIdxFromKey = (k: string) => {
      const [y, m] = k.split("-").map(Number);
      return y * 12 + (m - 1);
    };

    // Group passing clients by cohort (activated_at month)
    const buckets = new Map<string, ClientLite[]>();
    cohortKeys.forEach((k) => buckets.set(k, []));
    clients.forEach((c) => {
      if (!c.activated_at) return;
      if (!passFilter(c.id)) return;
      const d = new Date(c.activated_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      if (buckets.has(key)) buckets.get(key)!.push(c);
    });

    const rows = cohortKeys.map((ck) => {
      const cohortIdx = monthIdxFromKey(ck);
      const members = buckets.get(ck)!;
      const size = members.length;
      const cells = Array.from({ length: ELAPSED + 1 }, (_, n) => {
        const refIdx = cohortIdx + n;
        if (refIdx > curMonthIdx) return { n, retained: null as number | null, pct: null as number | null };
        if (size === 0) return { n, retained: 0, pct: null };
        // retained if not churned before end of ref month
        const refY = Math.floor(refIdx / 12);
        const refM = refIdx % 12;
        const endOfRef = new Date(refY, refM + 1, 0); // last day of month
        let r = 0;
        members.forEach((c) => {
          if (!c.churned_at || new Date(c.churned_at) > endOfRef) r += 1;
        });
        return { n, retained: r, pct: r / size };
      });
      return { cohort: ck, size, cells };
    });
    return rows;
  }, [clients, country, executive, foodCat, currency]);

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Churn"
          description="Pérdida de clientes y revenue — análisis mensual, trimestral y anual"
        />
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
          <Coins className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Mostrando en</span>
          <span className="font-semibold tabular-nums">{displayCurrency}</span>
          {displayCountryName && <span className="text-muted-foreground">· {displayCountryName}</span>}
        </div>
      </div>

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
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">Último mes</SelectItem>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="12m">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasEstimated && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5 flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            Snapshots históricos estimados — la descomposición por <code>movement_type</code> no estaba
            disponible antes de la implementación de <code>client_price_history</code>. Las curvas pre-2024 se
            derivan del estado actual y pueden subestimar churn temprano.
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Logo Churn (mensual)"
          value={fmtPct(logoChurnMonth)}
          sub={`${cur?.logoChurnCount ?? 0} clientes / base ${cur?.logoBaseCount ?? 0}`}
          tone="destructive"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Logo Churn (trim. rolling)"
          value={fmtPct(logoChurnQ)}
          sub={`${last3.reduce((s, m) => s + m.logoChurnCount, 0)} clientes últimos 3m`}
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Revenue Churn (mensual)"
          value={fmtPct(revChurnMonth)}
          sub={`${fmtMoney(mrrLostLastMonth)} perdidos`}
          tone="destructive"
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Revenue Churn (trim. rolling)"
          value={fmtPct(revChurnQ)}
          sub={`${fmtMoney(last3.reduce((s, m) => s + m.churnMrr, 0))} últimos 3m`}
        />
        <KpiCard
          label="Churn anualizado (logo)"
          value={fmtPct(logoChurn12)}
          sub="últimos 12 meses"
        />
        <KpiCard
          label="Clientes churneados (mes)"
          value={String(churnedLastMonthCount)}
          sub={`${cur?.month.slice(0, 7) ?? ""}`}
        />
        <KpiCard
          label="MRR perdido (mes)"
          value={fmtMoney(mrrLostLastMonth)}
          sub="USD, baseline mes anterior"
        />
        <KpiCard
          label="Eventos en período"
          value={String(eventsInPeriod.length)}
          sub={`desde ${periodCutoff.slice(0, 7)}`}
        />
      </div>

      {/* Trend chart */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold">Tendencia de Churn % (24m)</div>
            <div className="text-xs text-muted-foreground">Logo Churn vs Revenue Churn mensual</div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={churnSeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                formatter={(v: any) => `${Number(v).toFixed(2)}%`}
              />
              <Legend />
              <Line type="monotone" dataKey="logoChurn" name="Logo Churn %" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revenueChurn" name="Revenue Churn %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* MRR lost bar + reason breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="font-semibold mb-1">MRR perdido por mes (USD)</div>
          <div className="text-xs text-muted-foreground mb-3">Baseline = MRR USD del mes anterior por cliente churneado</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={churnSeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: any) => fmtMoney(Number(v))}
                />
                <Bar dataKey="mrrLost" name="MRR perdido" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-1">Motivos de churn</div>
          <div className="text-xs text-muted-foreground mb-3">
            {period === "1m" ? "Último mes" : period === "3m" ? "Últimos 3 meses" : "Últimos 12 meses"}
          </div>
          {reasonBreakdown.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Sin eventos en el período</div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reasonBreakdown}
                      dataKey="count"
                      nameKey="reason"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {reasonBreakdown.map((_, i) => (
                        <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: any, _n: any, p: any) => [`${v} clientes`, REASON_LABEL[p.payload.reason] || p.payload.reason]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2">
                {reasonBreakdown.map((r, i) => (
                  <div key={r.reason} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: REASON_COLORS[i % REASON_COLORS.length] }} />
                      <span>{REASON_LABEL[r.reason] || r.reason}</span>
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      {r.count} · {fmtMoney(r.mrrUsd)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Events table */}
      <Card className="p-4">
        <div className="font-semibold mb-3">
          Eventos de churn — {period === "1m" ? "último mes" : period === "3m" ? "últimos 3 meses" : "últimos 12 meses"}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">MRR perdido</TableHead>
                <TableHead className="text-right">USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsInPeriod.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin eventos en el período seleccionado
                  </TableCell>
                </TableRow>
              )}
              {eventsInPeriod.map((e) => {
                const c = clientById.get(e.client_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums">{e.churned_at}</TableCell>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{REASON_LABEL[e.reason_code] || e.reason_code}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{e.reason_detail || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(e.mrr_lost || 0).toLocaleString()} {e.currency}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(e.mrr_lost_usd || 0))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Cohort retention heatmap */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" /> Retención por cohorte
            </div>
            <div className="text-xs text-muted-foreground">
              % de clientes que siguen activos N meses después de su alta. Celdas en gris = mes futuro.
            </div>
          </div>
        </div>
        <CohortHeatmap rows={cohort} />
      </Card>

      {/* Clientes en riesgo — placeholder */}
      <Card className="p-4 border-dashed">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2">
              Clientes en riesgo
              <Badge variant="outline" className="text-[10px]">Próximamente</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Requiere integración con el sistema de <strong>Gestión &amp; Marketing</strong> para
              consumir el Health Score por cliente (uso del producto, tickets, NPS, retraso de pagos).
              Cuando esté disponible se listarán acá los clientes con mayor probabilidad de churn en los
              próximos 30/60/90 días.
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}

function CohortHeatmap({
  rows,
}: {
  rows: { cohort: string; size: number; cells: { n: number; retained: number | null; pct: number | null }[] }[];
}) {
  const hasData = rows.some((r) => r.size > 0);
  if (!hasData) {
    return (
      <div className="text-sm text-muted-foreground py-10 text-center border border-dashed rounded-md">
        Aún no hay altas suficientes en los últimos 12 meses para construir cohortes.
      </div>
    );
  }
  const cellColor = (pct: number | null) => {
    if (pct === null) return "bg-muted/30 text-muted-foreground";
    if (pct >= 0.9) return "bg-emerald-500/80 text-white";
    if (pct >= 0.75) return "bg-emerald-500/55 text-white";
    if (pct >= 0.6) return "bg-amber-500/55 text-white";
    if (pct >= 0.4) return "bg-orange-500/60 text-white";
    return "bg-destructive/70 text-white";
  };
  const elapsed = rows[0]?.cells.length ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-left text-muted-foreground font-normal px-2">Cohorte (alta)</th>
            <th className="text-right text-muted-foreground font-normal px-2">N</th>
            {Array.from({ length: elapsed }, (_, i) => (
              <th key={i} className="text-center text-muted-foreground font-normal w-12">M{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort}>
              <td className="px-2 tabular-nums">{r.cohort.slice(0, 7)}</td>
              <td className="px-2 text-right tabular-nums text-muted-foreground">{r.size}</td>
              {r.cells.map((c) => (
                <td
                  key={c.n}
                  className={`w-12 h-8 text-center rounded ${cellColor(c.pct)}`}
                  title={
                    c.pct === null
                      ? "Mes futuro"
                      : `${c.retained}/${r.size} activos (${(c.pct * 100).toFixed(0)}%)`
                  }
                >
                  {c.pct === null ? "—" : r.size === 0 ? "·" : `${Math.round(c.pct * 100)}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
        <span>Escala:</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/70" /> &lt;40%</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-500/60" /> 40-60%</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500/55" /> 60-75%</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/55" /> 75-90%</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/80" /> ≥90%</span>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, tone,
}: { icon?: React.ReactNode; label: string; value: string; sub?: string; tone?: "destructive" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "destructive" ? "text-destructive" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
