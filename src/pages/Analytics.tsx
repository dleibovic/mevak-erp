import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from "recharts";
import { formatMoney } from "@/lib/format";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { MonthFilter, currentMonthValue, monthLabel, monthRange } from "@/components/MonthFilter";


const COLORS = ["hsl(35 95% 60%)", "hsl(20 90% 55%)", "hsl(145 60% 48%)", "hsl(200 80% 55%)", "hsl(280 70% 60%)", "hsl(0 75% 60%)", "hsl(50 90% 55%)", "hsl(170 60% 45%)", "hsl(310 65% 60%)", "hsl(220 70% 60%)"];

type Period = "month" | "quarter" | "semester" | "year";

function getPeriodRange(period: Period, year: number, anchor: number) {
  // anchor = month index for month, quarter index 0..3, semester 0..1, ignored for year
  let start: Date, end: Date;
  if (period === "month") { start = new Date(year, anchor, 1); end = new Date(year, anchor + 1, 1); }
  else if (period === "quarter") { start = new Date(year, anchor * 3, 1); end = new Date(year, anchor * 3 + 3, 1); }
  else if (period === "semester") { start = new Date(year, anchor * 6, 1); end = new Date(year, anchor * 6 + 6, 1); }
  else { start = new Date(year, 0, 1); end = new Date(year + 1, 0, 1); }
  return { start, end };
}

function monthsInRange(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function Analytics() {
  const { countryId, current } = useCountryFilter();
  const [month, setMonth] = useState<string>(currentMonthValue());

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description={`${current ? `Reportes — ${current.name}` : "Reportes y desempeño"} · ${monthLabel(month)}`}
        actions={<MonthFilter value={month} onChange={setMonth} />}
      />

      <Tabs defaultValue="admin" className="w-full">
        <TabsList>
          <TabsTrigger value="admin">Administración</TabsTrigger>
          <TabsTrigger value="ops">Plataformas y ejecutivos</TabsTrigger>
        </TabsList>

        <TabsContent value="admin"><AdminDashboard countryId={countryId} month={month} /></TabsContent>
        <TabsContent value="ops"><OpsDashboard countryId={countryId} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ---------- Administración ---------- */

function AdminDashboard({ countryId, month }: { countryId: string | null; month: string }) {
  const now = new Date();
  const [period, setPeriod] = useState<Period>("year");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [anchor, setAnchor] = useState<number>(period === "month" ? now.getMonth() : 0);

  const mRange = monthRange(month);

  const { start, end } = useMemo(() => {
    if (mRange) return { start: new Date(mRange.start + "T00:00:00"), end: new Date(mRange.end + "T00:00:00") };
    return getPeriodRange(period, year, anchor);
  }, [period, year, anchor, month]);
  const monthsCount = monthsInRange(start, end);

  // Data
  const { data: invoices = [] } = useQuery({
    queryKey: ["an-invoices", countryId, month],
    queryFn: async () => {
      let q = supabase.from("invoices").select("*, client:clients(id, company_name, country_id, assigned_executive_id, monthly_fee, fee_currency)");
      if (mRange) q = q.gte("due_date", mRange.start).lt("due_date", mRange.end);
      return (await q).data ?? [];
    },
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["an-expenses", countryId, month],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*, category:expense_categories(id, name)");
      if (mRange) q = q.gte("date", mRange.start).lt("date", mRange.end);
      return (await q).data ?? [];
    },
  });
  const { data: transactions = [] } = useQuery({
    queryKey: ["an-transactions", countryId, month],
    queryFn: async () => {
      let q = supabase.from("transactions").select("*");
      if (mRange) q = q.gte("date", mRange.start).lt("date", mRange.end);
      return (await q).data ?? [];
    },
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["an-employees", countryId],
    queryFn: async () => (await supabase.from("employees").select("id, full_name, base_salary, salary_currency, country_id, is_active, start_date, end_date")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["an-clients", countryId],
    queryFn: async () => (await supabase.from("clients").select("id, company_name, country_id, monthly_fee, fee_currency, status")).data ?? [],
  });

  const inCountry = (cid?: string | null) => !countryId || cid === countryId;
  const inRange = (d: string | Date) => { const x = new Date(d); return x >= start && x < end; };


  /* Totals by currency */
  const totals = useMemo(() => {
    const inc: Record<string, number> = {};
    const incPaid: Record<string, number> = {};
    const incPending: Record<string, number> = {};
    const incOverdue: Record<string, number> = {};
    invoices.forEach((i: any) => {
      if (!inCountry(i.client?.country_id)) return;
      if (!inRange(i.due_date)) return;
      const cur = i.currency;
      const amt = Number(i.amount) || 0;
      inc[cur] = (inc[cur] ?? 0) + amt;
      if (i.status === "paid") incPaid[cur] = (incPaid[cur] ?? 0) + amt;
      else if (i.status === "overdue") incOverdue[cur] = (incOverdue[cur] ?? 0) + amt;
      else incPending[cur] = (incPending[cur] ?? 0) + amt;
    });

    const exp: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (!inCountry(e.country_id)) return;
      if (!inRange(e.date)) return;
      exp[e.currency] = (exp[e.currency] ?? 0) + (Number(e.amount) || 0);
    });
    // Salaries (active in range)
    employees.forEach((e: any) => {
      if (!e.is_active) return;
      if (!inCountry(e.country_id)) return;
      const cur = e.salary_currency || "ARS";
      exp[cur] = (exp[cur] ?? 0) + (Number(e.base_salary) || 0) * monthsCount;
    });

    // Movimientos registrados en transactions (caja) — filtrados por su fecha
    const txIn: Record<string, number> = {};
    const txOut: Record<string, number> = {};
    transactions.forEach((t: any) => {
      if (!inRange(t.date)) return;
      const cur = t.currency || "ARS";
      const amt = Number(t.amount) || 0;
      if (t.type === "income") txIn[cur] = (txIn[cur] ?? 0) + amt;
      else txOut[cur] = (txOut[cur] ?? 0) + amt;
    });

    const profit: Record<string, number> = {};
    new Set([...Object.keys(inc), ...Object.keys(exp)]).forEach((c) => {
      profit[c] = (inc[c] ?? 0) - (exp[c] ?? 0);
    });

    return { inc, incPaid, incPending, incOverdue, exp, profit, txIn, txOut };
  }, [invoices, expenses, employees, transactions, countryId, period, year, anchor, monthsCount, month]);


  /* Expenses by category (with salaries) */
  const expByCategory = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}; // cat -> currency -> amount
    expenses.forEach((e: any) => {
      if (!inCountry(e.country_id) || !inRange(e.date)) return;
      const k = e.category?.name ?? "Sin categoría";
      m[k] = m[k] ?? {};
      m[k][e.currency] = (m[k][e.currency] ?? 0) + (Number(e.amount) || 0);
    });
    employees.forEach((e: any) => {
      if (!e.is_active || !inCountry(e.country_id)) return;
      const cur = e.salary_currency || "ARS";
      const k = "Salarios";
      m[k] = m[k] ?? {};
      m[k][cur] = (m[k][cur] ?? 0) + (Number(e.base_salary) || 0) * monthsCount;
    });
    return m;
  }, [expenses, employees, countryId, period, year, anchor, monthsCount]);

  /* Monthly series (income vs expense, per currency aggregated as ARS-equivalent? Keep separate per currency). For chart, aggregate using ARS only for visualization. */
  const monthlySeries = useMemo(() => {
    const months: { key: string; label: string; ingresos: number; egresos: number; ganancia: number }[] = [];
    const cur = new Date(start);
    while (cur < end) {
      const k = `${cur.getFullYear()}-${cur.getMonth()}`;
      months.push({ key: k, label: `${MONTHS_ES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, ingresos: 0, egresos: 0, ganancia: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
    const idx = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    invoices.forEach((i: any) => {
      if (!inCountry(i.client?.country_id) || i.currency !== "ARS") return;
      const d = new Date(i.due_date);
      const m = months.find((x) => x.key === idx(d));
      if (m) m.ingresos += Number(i.amount) || 0;
    });
    expenses.forEach((e: any) => {
      if (!inCountry(e.country_id) || e.currency !== "ARS") return;
      const d = new Date(e.date);
      const m = months.find((x) => x.key === idx(d));
      if (m) m.egresos += Number(e.amount) || 0;
    });
    // Salaries each month for active employees
    employees.forEach((e: any) => {
      if (!e.is_active || !inCountry(e.country_id) || (e.salary_currency || "ARS") !== "ARS") return;
      months.forEach((m) => { m.egresos += Number(e.base_salary) || 0; });
    });
    months.forEach((m) => { m.ganancia = m.ingresos - m.egresos; });
    return months;
  }, [invoices, expenses, employees, countryId, start, end]);

  /* Top 10 clientes por fee */
  const topClients = useMemo(() => {
    return clients
      .filter((c: any) => inCountry(c.country_id) && c.status !== "inactive")
      .map((c: any) => ({ id: c.id, name: c.company_name, fee: Number(c.monthly_fee) || 0, currency: c.fee_currency || "ARS" }))
      .sort((a, b) => b.fee - a.fee)
      .slice(0, 10);
  }, [clients, countryId]);

  /* Pareto clientes (revenue cobrado/total per cliente en periodo) */
  const paretoClients = useMemo(() => {
    const m: Record<string, { name: string; value: number }> = {};
    invoices.forEach((i: any) => {
      if (!inCountry(i.client?.country_id) || !inRange(i.due_date) || i.currency !== "ARS") return;
      const id = i.client?.id ?? "—";
      const name = i.client?.company_name ?? "—";
      m[id] = m[id] ?? { name, value: 0 };
      m[id].value += Number(i.amount) || 0;
    });
    const arr = Object.values(m).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    return arr.slice(0, 20).map((x) => { acc += x.value; return { ...x, pct: (x.value / total) * 100, cum: (acc / total) * 100 }; });
  }, [invoices, countryId, start, end]);

  /* Pareto gastos por categoría */
  const paretoExpenses = useMemo(() => {
    const arr = Object.entries(expByCategory).map(([name, by]) => ({ name, value: by["ARS"] ?? 0 })).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    return arr.map((x) => { acc += x.value; return { ...x, pct: (x.value / total) * 100, cum: (acc / total) * 100 }; });
  }, [expByCategory]);

  const currencies = Array.from(new Set([...Object.keys(totals.inc), ...Object.keys(totals.exp)]));
  const yearOpts = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-3 bg-gradient-card border-border/60 flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={(v) => { setPeriod(v as Period); setAnchor(v === "month" ? now.getMonth() : 0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mensual</SelectItem>
            <SelectItem value="quarter">Trimestral</SelectItem>
            <SelectItem value="semester">Semestral</SelectItem>
            <SelectItem value="year">Anual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>{yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        {period === "month" && (
          <Select value={String(anchor)} onValueChange={(v) => setAnchor(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS_ES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {period === "quarter" && (
          <Select value={String(anchor)} onValueChange={(v) => setAnchor(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[0, 1, 2, 3].map((i) => <SelectItem key={i} value={String(i)}>{`T${i + 1}`}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {period === "semester" && (
          <Select value={String(anchor)} onValueChange={(v) => setAnchor(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[0, 1].map((i) => <SelectItem key={i} value={String(i)}>{`S${i + 1}`}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </Card>

      {/* KPIs por moneda */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ingresos" amounts={totals.inc} tone="success" />
        <KpiCard label="Egresos (incl. salarios)" amounts={totals.exp} tone="destructive" />
        <KpiCard label="Ganancia" amounts={totals.profit} tone="primary" />
        <KpiCard label="Cobrado" amounts={totals.incPaid} tone="success" sub={`Mora: ${currencies.map((c) => formatMoney(totals.incOverdue[c] ?? 0, c)).join(" / ") || "—"}`} />
      </div>

      {/* Monthly trend (ARS) */}
      <Card className="p-5 bg-gradient-card border-border/60">
        <h3 className="font-semibold mb-3">Ingresos vs Egresos (ARS) — mensual</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(v: any) => formatMoney(v as number, "ARS")} />
              <Legend />
              <Bar dataKey="ingresos" fill="hsl(145 60% 48%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" fill="hsl(0 75% 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ganancia" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Egresos por categoría */}
        <Card className="p-5 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Egresos por categoría (ARS)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={paretoExpenses} dataKey="value" nameKey="name" outerRadius={90} innerRadius={40}>
                  {paretoExpenses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(v: any) => formatMoney(v as number, "ARS")} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Categoría</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
            <TableBody>
              {paretoExpenses.map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(c.value, "ARS")}</TableCell>
                  <TableCell className="text-right">{c.pct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Cobros vs Mora */}
        <Card className="p-5 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Cobros vs Mora (ARS)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: "Cobrado", value: totals.incPaid["ARS"] ?? 0 },
                    { name: "Pendiente", value: totals.incPending["ARS"] ?? 0 },
                    { name: "Mora", value: totals.incOverdue["ARS"] ?? 0 },
                  ]}
                  dataKey="value" nameKey="name" outerRadius={90} innerRadius={40}
                >
                  <Cell fill="hsl(145 60% 48%)" />
                  <Cell fill="hsl(50 90% 55%)" />
                  <Cell fill="hsl(0 75% 60%)" />
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(v: any) => formatMoney(v as number, "ARS")} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top 10 clientes */}
      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold">Top 10 clientes por fee mensual</h3></div>
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Fee</TableHead></TableRow></TableHeader>
          <TableBody>
            {topClients.map((c, i) => (
              <TableRow key={c.id}><TableCell>{i + 1}</TableCell><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-right font-mono">{formatMoney(c.fee, c.currency)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pareto Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ParetoCard title="Pareto — Clientes (ingresos ARS)" data={paretoClients} />
        <ParetoCard title="Pareto — Gastos por categoría (ARS)" data={paretoExpenses} />
      </div>
    </div>
  );
}

function KpiCard({ label, amounts, tone, sub }: { label: string; amounts: Record<string, number>; tone: "success" | "destructive" | "primary"; sub?: string }) {
  const entries = Object.entries(amounts);
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card className="p-4 bg-gradient-card border-border/60">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 space-y-0.5">
        {entries.length === 0 ? <div className="text-lg font-mono">—</div> : entries.map(([cur, val]) => (
          <div key={cur} className={`text-lg font-mono ${toneClass}`}>{formatMoney(val, cur)}</div>
        ))}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>}
    </Card>
  );
}

function ParetoCard({ title, data }: { title: string; data: { name: string; value: number; pct: number; cum: number }[] }) {
  return (
    <Card className="p-5 bg-gradient-card border-border/60">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-30} textAnchor="end" height={70} />
            <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: any, n: any) => n === "cum" ? `${(v as number).toFixed(1)}%` : formatMoney(v as number, "ARS")} />
            <Legend />
            <Bar yAxisId="left" dataKey="value" fill="hsl(var(--primary))" name="$" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cum" stroke="hsl(20 90% 55%)" name="% acumulado" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------- Operacional (existing content) ---------- */

function OpsDashboard({ countryId }: { countryId: string | null }) {
  const { data: clients = [] } = useQuery({
    queryKey: ["analytics-clients", countryId],
    queryFn: async () => {
      let q = supabase.from("clients").select("*, executive:employees(id, full_name), client_platforms(*, platform:platforms(*)), invoices(*)");
      if (countryId) q = q.eq("country_id", countryId);
      return (await q).data ?? [];
    },
  });

  const platformBreakdown = useMemo(() => {
    const m: Record<string, { contracts: number; cmv: number }> = {};
    clients.forEach((c: any) => c.client_platforms?.forEach((cp: any) => {
      const k = cp.platform?.name ?? "—";
      m[k] = m[k] ?? { contracts: 0, cmv: 0 };
      m[k].contracts += 1;
      m[k].cmv += Number(cp.cmv_cost);
    }));
    return Object.entries(m).map(([name, v]) => ({ name, ...v }));
  }, [clients]);

  const execPerf = useMemo(() => {
    const m: Record<string, { name: string; clients: number; revenue: number; overdue: number; paid: number }> = {};
    clients.forEach((c: any) => {
      const id = c.executive?.id ?? "none";
      const name = c.executive?.full_name ?? "Sin asignar";
      m[id] = m[id] ?? { name, clients: 0, revenue: 0, overdue: 0, paid: 0 };
      m[id].clients += 1;
      c.invoices?.forEach((i: any) => {
        if (i.status === "paid") { m[id].paid += 1; m[id].revenue += Number(i.amount); }
        if (i.status === "overdue") m[id].overdue += 1;
      });
    });
    return Object.values(m);
  }, [clients]);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Contratos por plataforma</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={platformBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                <Bar dataKey="contracts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">CMV por plataforma</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={platformBreakdown} dataKey="cmv" nameKey="name" outerRadius={90} innerRadius={40}>
                  {platformBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold">Desempeño de ejecutivos</h3></div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ejecutivo</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Cobradas</TableHead>
              <TableHead>Vencidas</TableHead>
              <TableHead>Tasa cobro</TableHead>
              <TableHead className="text-right">Revenue cobrado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {execPerf.map((e: any) => {
              const total = e.paid + e.overdue;
              const rate = total > 0 ? (e.paid / total) * 100 : 0;
              return (
                <TableRow key={e.name}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.clients}</TableCell>
                  <TableCell className="text-success">{e.paid}</TableCell>
                  <TableCell className="text-destructive">{e.overdue}</TableCell>
                  <TableCell>{rate.toFixed(0)}%</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(e.revenue, "ARS")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
