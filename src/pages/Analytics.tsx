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
import { buildRateIndex, rateForMonth, toUsd as toUsdRate, monthsList, type RateRow } from "@/lib/monthlyRates";

const COLORS = ["hsl(35 95% 60%)", "hsl(20 90% 55%)", "hsl(145 60% 48%)", "hsl(200 80% 55%)", "hsl(280 70% 60%)", "hsl(0 75% 60%)", "hsl(50 90% 55%)", "hsl(170 60% 45%)", "hsl(310 65% 60%)", "hsl(220 70% 60%)"];

const usdFmt = (v: number) => formatMoney(v as number, "USD");

type Period = "month" | "quarter" | "semester" | "year";

function getPeriodRange(period: Period, year: number, anchor: number) {
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

/* ---------- Administración (todo consolidado en USD por cotización mensual) ---------- */

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
  const mArr = useMemo(() => monthsList(start, end), [start, end]);

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
  const { data: rates = [] } = useQuery({
    queryKey: ["an-rates"],
    queryFn: async () => ((await supabase.from("exchange_rates").select("base_currency, rate, rate_date")).data ?? []) as RateRow[],
  });

  const rateIndex = useMemo(() => buildRateIndex(rates as RateRow[]), [rates]);
  const usd = (amount: number, currency: string, dateOrMonth: string | Date) => toUsdRate(rateIndex, amount, currency, dateOrMonth);
  // Fecha para valuar una factura: la de PAGO (collected_at) si ya se cobró; si no, el vencimiento.
  const invValDate = (i: any) => i.collected_at ?? i.due_date;

  const inCountry = (cid?: string | null) => !countryId || cid === countryId;
  const inRange = (d: string | Date) => { const x = new Date(d); return x >= start && x < end; };

  /* Totales en USD (convertidos por la cotización del mes de cada monto) */
  const totals = useMemo(() => {
    let inc = 0, incPaid = 0, incPending = 0, incOverdue = 0, exp = 0, txIn = 0, txOut = 0;
    invoices.forEach((i: any) => {
      if (!inCountry(i.client?.country_id) || !inRange(i.due_date)) return;
      const v = usd(Number(i.amount) || 0, i.currency, invValDate(i));
      inc += v;
      if (i.status === "paid") incPaid += v;
      else if (i.status === "overdue") incOverdue += v;
      else incPending += v;
    });
    expenses.forEach((e: any) => {
      if (!inCountry(e.country_id) || !inRange(e.date)) return;
      exp += usd(Number(e.amount) || 0, e.currency, e.date);
    });
    employees.forEach((e: any) => {
      if (!e.is_active || !inCountry(e.country_id)) return;
      mArr.forEach((mo) => { exp += usd(Number(e.base_salary) || 0, e.salary_currency || "ARS", mo); });
    });
    transactions.forEach((t: any) => {
      if (!inRange(t.date)) return;
      const v = usd(Number(t.amount) || 0, t.currency || "ARS", t.date);
      if (t.type === "income") txIn += v; else txOut += v;
    });
    return { inc, incPaid, incPending, incOverdue, exp, profit: inc - exp, txIn, txOut };
  }, [invoices, expenses, employees, transactions, countryId, start, end, mArr, rateIndex]);

  /* Egresos por categoría (USD) */
  const expByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (!inCountry(e.country_id) || !inRange(e.date)) return;
      const k = e.category?.name ?? "Sin categoría";
      m[k] = (m[k] ?? 0) + usd(Number(e.amount) || 0, e.currency, e.date);
    });
    employees.forEach((e: any) => {
      if (!e.is_active || !inCountry(e.country_id)) return;
      let s = 0;
      mArr.forEach((mo) => { s += usd(Number(e.base_salary) || 0, e.salary_currency || "ARS", mo); });
      m["Salarios"] = (m["Salarios"] ?? 0) + s;
    });
    return m;
  }, [expenses, employees, countryId, start, end, mArr, rateIndex]);

  /* Serie mensual (USD) */
  const monthlySeries = useMemo(() => {
    const months = mArr.map((k) => {
      const [y, mo] = k.split("-").map(Number);
      return { key: k, label: `${MONTHS_ES[mo - 1]} ${String(y).slice(2)}`, ingresos: 0, egresos: 0, ganancia: 0 };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    const keyOf = (d: string | Date) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
    invoices.forEach((i: any) => {
      if (!inCountry(i.client?.country_id)) return;
      const m = byKey.get(keyOf(invValDate(i)));
      if (m) m.ingresos += usd(Number(i.amount) || 0, i.currency, invValDate(i));
    });
    expenses.forEach((e: any) => {
      if (!inCountry(e.country_id)) return;
      const m = byKey.get(keyOf(e.date));
      if (m) m.egresos += usd(Number(e.amount) || 0, e.currency, e.date);
    });
    employees.forEach((e: any) => {
      if (!e.is_active || !inCountry(e.country_id)) return;
      months.forEach((m) => { m.egresos += usd(Number(e.base_salary) || 0, e.salary_currency || "ARS", m.key); });
    });
    months.forEach((m) => { m.ganancia = m.ingresos - m.egresos; });
    return months;
  }, [invoices, expenses, employees, countryId, mArr, rateIndex]);

  /* Top 10 clientes por fee (en su moneda original) */
  const topClients = useMemo(() => {
    return clients
      .filter((c: any) => inCountry(c.country_id) && c.status !== "inactive")
      .map((c: any) => ({ id: c.id, name: c.company_name, fee: Number(c.monthly_fee) || 0, currency: c.fee_currency || "ARS" }))
      .sort((a, b) => b.fee - a.fee)
      .slice(0, 10);
  }, [clients, countryId]);

  /* Pareto clientes (ingresos en USD) */
  const paretoClients = useMemo(() => {
    const m: Record<string, { name: string; value: number }> = {};
    invoices.forEach((i: any) => {
      if (!inCountry(i.client?.country_id) || !inRange(i.due_date)) return;
      const id = i.client?.id ?? "—";
      const name = i.client?.company_name ?? "—";
      m[id] = m[id] ?? { name, value: 0 };
      m[id].value += usd(Number(i.amount) || 0, i.currency, invValDate(i));
    });
    const arr = Object.values(m).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    return arr.slice(0, 20).map((x) => { acc += x.value; return { ...x, pct: (x.value / total) * 100, cum: (acc / total) * 100 }; });
  }, [invoices, countryId, start, end, rateIndex]);

  /* Pareto gastos por categoría (USD) */
  const paretoExpenses = useMemo(() => {
    const arr = Object.entries(expByCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    return arr.map((x) => { acc += x.value; return { ...x, pct: (x.value / total) * 100, cum: (acc / total) * 100 }; });
  }, [expByCategory]);

  /* Tipos de cambio usados (para transparencia) */
  const dataCurrencies = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach((i: any) => { if (inCountry(i.client?.country_id) && inRange(i.due_date)) s.add(i.currency); });
    expenses.forEach((e: any) => { if (inCountry(e.country_id) && inRange(e.date)) s.add(e.currency); });
    employees.forEach((e: any) => { if (e.is_active && inCountry(e.country_id)) s.add(e.salary_currency || "ARS"); });
    transactions.forEach((t: any) => { if (inRange(t.date)) s.add(t.currency || "ARS"); });
    s.delete("USD");
    return [...s];
  }, [invoices, expenses, employees, transactions, countryId, start, end]);

  const ratesUsed = useMemo(() => {
    const rows: { currency: string; month: string; rate: number | null; estimated: boolean }[] = [];
    for (const cur of dataCurrencies) {
      for (const mo of mArr) {
        const { rate, estimated } = rateForMonth(rateIndex, cur, mo);
        rows.push({ currency: cur, month: mo, rate, estimated });
      }
    }
    return rows;
  }, [dataCurrencies, mArr, rateIndex]);

  const yearOpts = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-3 bg-gradient-card border-border/60 flex flex-wrap items-center gap-2">
        {mRange ? (
          <div className="text-sm text-muted-foreground">
            Métricas acotadas al mes seleccionado: <span className="capitalize font-medium text-foreground">{monthLabel(month)}</span>. Elegí "Todos los meses" para usar los períodos.
          </div>
        ) : (
          <>
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
          </>
        )}
      </Card>

      {/* KPIs en USD */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ingresos" amount={totals.inc} tone="success" />
        <KpiCard label="Egresos (incl. salarios)" amount={totals.exp} tone="destructive" />
        <KpiCard label="Ganancia" amount={totals.profit} tone="primary" />
        <KpiCard label="Cobrado" amount={totals.incPaid} tone="success" sub={`Mora: ${usdFmt(totals.incOverdue)}`} />
      </div>

      {/* Movimientos de caja (transactions) */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <KpiCard label="Movimientos — ingresos" amount={totals.txIn} tone="success" />
        <KpiCard label="Movimientos — egresos" amount={totals.txOut} tone="destructive" />
      </div>

      {/* Tipos de cambio usados */}
      {ratesUsed.length > 0 && (
        <Card className="bg-gradient-card border-border/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold">Tipos de cambio aplicados (cotización mensual, moneda local por 1 USD)</h3>
          </div>
          <div className="max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">TC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratesUsed.map((r, i) => (
                  <TableRow key={`${r.currency}-${r.month}-${i}`}>
                    <TableCell>{r.currency}</TableCell>
                    <TableCell>{r.month}</TableCell>
                    <TableCell className="text-right font-mono">
                      {r.rate == null ? <span className="text-destructive">sin cotización</span> : (
                        <>
                          {r.rate.toLocaleString("es-AR")}
                          {r.estimated && <span className="text-muted-foreground text-[11px] ml-1">(est.)</span>}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Serie mensual (USD) */}
      <Card className="p-5 bg-gradient-card border-border/60">
        <h3 className="font-semibold mb-3">Ingresos vs Egresos (USD) — mensual</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(v: any) => usdFmt(v as number)} />
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
          <h3 className="font-semibold mb-3">Egresos por categoría (USD)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={paretoExpenses} dataKey="value" nameKey="name" outerRadius={90} innerRadius={40}>
                  {paretoExpenses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(v: any) => usdFmt(v as number)} />
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
                  <TableCell className="text-right font-mono">{usdFmt(c.value)}</TableCell>
                  <TableCell className="text-right">{c.pct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Cobros vs Mora */}
        <Card className="p-5 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Cobros vs Mora (USD)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: "Cobrado", value: totals.incPaid },
                    { name: "Pendiente", value: totals.incPending },
                    { name: "Mora", value: totals.incOverdue },
                  ]}
                  dataKey="value" nameKey="name" outerRadius={90} innerRadius={40}
                >
                  <Cell fill="hsl(145 60% 48%)" />
                  <Cell fill="hsl(50 90% 55%)" />
                  <Cell fill="hsl(0 75% 60%)" />
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(v: any) => usdFmt(v as number)} />
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
        <ParetoCard title="Pareto — Clientes (ingresos USD)" data={paretoClients} />
        <ParetoCard title="Pareto — Gastos por categoría (USD)" data={paretoExpenses} />
      </div>
    </div>
  );
}

function KpiCard({ label, amount, tone, sub }: { label: string; amount: number; tone: "success" | "destructive" | "primary"; sub?: string }) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card className="p-4 bg-gradient-card border-border/60">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-mono ${toneClass}`}>{usdFmt(amount)}</div>
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
              formatter={(v: any, n: any) => n === "cum" ? `${(v as number).toFixed(1)}%` : usdFmt(v as number)} />
            <Legend />
            <Bar yAxisId="left" dataKey="value" fill="hsl(var(--primary))" name="USD" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cum" stroke="hsl(20 90% 55%)" name="% acumulado" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------- Operacional (sin cambios) ---------- */

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
