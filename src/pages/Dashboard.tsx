import { forwardRef, useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { formatMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Users, ReceiptText, AlertTriangle } from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { useCountryFilter } from "@/hooks/useCountryFilter";

const COLORS = ["hsl(35 95% 60%)", "hsl(20 90% 55%)", "hsl(145 60% 48%)", "hsl(200 80% 55%)", "hsl(280 70% 60%)", "hsl(0 75% 60%)", "hsl(50 90% 55%)", "hsl(170 70% 50%)"];

export default function Dashboard() {
  const { countries, countryId } = useCountryFilter();
  const [supportsCharts, setSupportsCharts] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent ?? "";
    const platform = window.navigator.platform ?? "";
    const touchPoints = window.navigator.maxTouchPoints ?? 0;
    const isIOS = /iP(hone|ad|od)/i.test(ua) || (platform === "MacIntel" && touchPoints > 1);
    const hasResizeObserver = typeof window.ResizeObserver !== "undefined";

    setSupportsCharts(hasResizeObserver && !isIOS);
  }, []);

  const { data: invoicesAll = [] } = useQuery({
    queryKey: ["dash-invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, client:clients(company_name, country_id)")).data ?? [],
  });
  const { data: clientsAll = [] } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, country_id, monthly_fee, fee_currency, billing_frequency, branches_count, fee_billing_mode, status")).data ?? [],
  });
  const { data: prospectsAll = [] } = useQuery({
    queryKey: ["dash-prospects"],
    queryFn: async () => (await supabase.from("prospects").select("id, country_id, currency, estimated_monthly_revenue, status")).data ?? [],
    refetchOnMount: "always",
  });
  const { data: expensesAll = [] } = useQuery({
    queryKey: ["dash-expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*, category:expense_categories(name)")).data ?? [],
  });
  const { data: employeesAll = [] } = useQuery({
    queryKey: ["dash-employees"],
    queryFn: async () => (await supabase.from("employees").select("*, commissions:client_executive_commission(commission_value, currency)")).data ?? [],
  });

  const matchesCountry = (cid?: string | null) => !countryId || cid === countryId;
  const invoices = invoicesAll.filter((i: any) => matchesCountry(i.client?.country_id));
  const clients = clientsAll.filter((c: any) => matchesCountry(c.country_id));
  const prospects = prospectsAll.filter((p: any) => matchesCountry(p.country_id));
  const expenses = expensesAll.filter((e: any) => matchesCountry(e.country_id));
  const employees = employeesAll.filter((e: any) => matchesCountry(e.country_id));
  const activeCurrency = null;

  const stats = useMemo(() => {
    const sumByCurr = (rows: any[], key = "amount") => rows.reduce((acc: any, r: any) => { acc[r.currency] = (acc[r.currency] ?? 0) + Number(r[key]); return acc; }, {});
    const billingMultiplier = (frequency?: string | null) => frequency === "weekly" ? 4 : frequency === "biweekly" ? 2 : 1;
    const normalizedClientFee = (c: any) => {
      const branches = c.fee_billing_mode === "flat" ? 1 : Math.max(1, Number(c.branches_count || 1));
      return Number(c.monthly_fee || 0) * branches * billingMultiplier(c.billing_frequency);
    };
    const sumClientFees = (currency: string) => clients.filter((c: any) => c.fee_currency === currency && c.status === "active").reduce((acc: number, c: any) => acc + normalizedClientFee(c), 0);
    const isOverdue = (i: any) => i.status === "overdue" || (i.status === "pending" && i.due_date && new Date(i.due_date) < new Date());
    if (activeCurrency) {
      const c = activeCurrency;
      const income = sumByCurr(invoices.filter((i: any) => i.status === "paid" && i.currency === c))[c] ?? 0;
      const overdue = sumByCurr(invoices.filter((i: any) => isOverdue(i) && i.currency === c))[c] ?? 0;
      const totalBilling = sumClientFees(c);
      const exp = sumByCurr(expenses.filter((e: any) => e.currency === c))[c] ?? 0;
      const payroll = employees.reduce((acc: number, e: any) => {
        if (e.salary_currency !== c) return acc;
        const comm = (e.commissions ?? []).filter((cm: any) => cm.currency === c).reduce((a: number, cm: any) => a + Number(cm.commission_value), 0);
        return acc + Number(e.base_salary || 0) + comm;
      }, 0);
      return { mode: "single" as const, currency: c, clientCount: clients.length, totalBilling, income, overdue, exp, payroll, net: income - exp - payroll };
    }
    const currencies = Array.from(new Set([
      ...clients.map((c: any) => c.fee_currency),
      ...invoices.map((i: any) => i.currency),
      ...expenses.map((e: any) => e.currency),
      ...employees.map((e: any) => e.salary_currency),
    ].filter(Boolean))).sort();
    const paidByCurrency = sumByCurr(invoices.filter((i: any) => i.status === "paid"));
    const overdueByCurrency = sumByCurr(invoices.filter(isOverdue));
    const expensesByCurrency = sumByCurr(expenses);
    const rows = currencies.map((currency) => {
      const payroll = employees.reduce((acc: number, e: any) => {
        const base = e.salary_currency === currency ? Number(e.base_salary || 0) : 0;
        const comm = (e.commissions ?? []).filter((c: any) => c.currency === currency).reduce((a: number, c: any) => a + Number(c.commission_value), 0);
        return acc + base + comm;
      }, 0);
      const income = paidByCurrency[currency] ?? 0;
      const exp = expensesByCurrency[currency] ?? 0;
      return { currency, totalBilling: sumClientFees(currency), income, overdue: overdueByCurrency[currency] ?? 0, exp, payroll, net: income - exp - payroll };
    });
    return { mode: "multi" as const, clientCount: clients.length, rows };
  }, [invoices, clients, expenses, employees, activeCurrency]);

  const countrySummaries = useMemo(() => {
    const billingMultiplier = (frequency?: string | null) => frequency === "weekly" ? 4 : frequency === "biweekly" ? 2 : 1;
    const countryName = (countryId?: string | null) => countries.find((c) => c.id === countryId)?.name ?? "Sin país";
    const countryIds = Array.from(new Set([
      ...clients.map((c: any) => c.country_id),
      ...expenses.map((e: any) => e.country_id),
      ...employees.map((e: any) => e.country_id),
      ...invoices.map((i: any) => i.client?.country_id),
    ].filter(Boolean))).sort((a: any, b: any) => countryName(a).localeCompare(countryName(b)));
    const isOverdue = (i: any) => i.status === "overdue" || (i.status === "pending" && i.due_date && new Date(i.due_date) < new Date());

    return countryIds.map((countryId: string) => {
      const countryClients = clients.filter((c: any) => c.country_id === countryId);
      const countryInvoices = invoices.filter((i: any) => i.client?.country_id === countryId);
      const countryExpenses = expenses.filter((e: any) => e.country_id === countryId);
      const countryEmployees = employees.filter((e: any) => e.country_id === countryId);
      const currencies = Array.from(new Set([
        ...countryClients.map((c: any) => c.fee_currency),
        ...countryInvoices.map((i: any) => i.currency),
        ...countryExpenses.map((e: any) => e.currency),
        ...countryEmployees.map((e: any) => e.salary_currency),
      ].filter(Boolean))).sort();
      const rows = currencies.map((currency) => {
        const totalBilling = countryClients
          .filter((c: any) => c.fee_currency === currency && c.status === "active")
          .reduce((acc: number, c: any) => acc + Number(c.monthly_fee || 0) * (c.fee_billing_mode === "flat" ? 1 : Math.max(1, Number(c.branches_count || 1))) * billingMultiplier(c.billing_frequency), 0);
        const income = countryInvoices
          .filter((i: any) => i.status === "paid" && i.currency === currency)
          .reduce((acc: number, i: any) => acc + Number(i.amount || 0), 0);
        const overdue = countryInvoices
          .filter((i: any) => isOverdue(i) && i.currency === currency)
          .reduce((acc: number, i: any) => acc + Number(i.amount || 0), 0);
        const exp = countryExpenses
          .filter((e: any) => e.currency === currency)
          .reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0);
        const payroll = countryEmployees.reduce((acc: number, e: any) => {
          const base = e.salary_currency === currency ? Number(e.base_salary || 0) : 0;
          const comm = (e.commissions ?? []).filter((c: any) => c.currency === currency).reduce((a: number, c: any) => a + Number(c.commission_value || 0), 0);
          return acc + base + comm;
        }, 0);
        return { currency, totalBilling, income, overdue, exp, payroll, net: income - exp - payroll };
      });

      return { countryId, countryName: countryName(countryId), clientCount: countryClients.length, rows };
    });
  }, [countries, clients, invoices, expenses, employees]);

  const series = useMemo(() => {
    const map: Record<string, any> = {};
    const okCurr = (r: any) => !activeCurrency || r.currency === activeCurrency;
    invoices.filter((i: any) => i.status === "paid" && i.collected_at && okCurr(i)).forEach((i: any) => {
      const k = format(startOfMonth(parseISO(i.collected_at)), "yyyy-MM");
      map[k] = map[k] ?? { month: k, ingresos: 0, gastos: 0 };
      map[k].ingresos += Number(i.amount);
    });
    expenses.filter(okCurr).forEach((e: any) => {
      const k = format(startOfMonth(parseISO(e.date)), "yyyy-MM");
      map[k] = map[k] ?? { month: k, ingresos: 0, gastos: 0 };
      map[k].gastos += Number(e.amount);
    });
    return Object.values(map).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [invoices, expenses, activeCurrency]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.filter((e: any) => !activeCurrency || e.currency === activeCurrency).forEach((e: any) => {
      const k = e.category?.name ?? "Sin categoría";
      map[k] = (map[k] ?? 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses, activeCurrency]);

  const byClient = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.filter((i: any) => i.status === "paid" && (!activeCurrency || i.currency === activeCurrency)).forEach((i: any) => {
      const k = i.client?.company_name ?? "—";
      map[k] = (map[k] ?? 0) + Number(i.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [invoices, activeCurrency]);

  const prospectSummary = useMemo(() => {
    const activeProspects = prospects.filter((p: any) => p.status === "active");
    const map: Record<string, { countryName: string; count: number; currencies: Record<string, number> }> = {};
    activeProspects.forEach((p: any) => {
      const country = countries.find((c) => c.id === p.country_id);
      const key = p.country_id ?? "unknown";
      const currency = p.currency ?? country?.currency_code ?? "ARS";
      map[key] = map[key] ?? { countryName: country?.name ?? "Sin país", count: 0, currencies: {} };
      map[key].count += 1;
      map[key].currencies[currency] = (map[key].currencies[currency] ?? 0) + Number(p.estimated_monthly_revenue || 0);
    });
    return Object.values(map)
      .map((item) => ({ ...item, rows: Object.entries(item.currencies).map(([currency, potential]) => ({ currency, potential })).sort((a, b) => a.currency.localeCompare(b.currency)) }))
      .sort((a, b) => a.countryName.localeCompare(b.countryName));
  }, [prospects, countries]);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Cuenta corriente general — todos los países"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KCard label="Clientes totales" value={String(stats.clientCount)} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
          <h2 className="text-lg font-semibold">Resumen por país</h2>
          <span className="text-xs text-muted-foreground">Valores mensualizados por frecuencia de cobro</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {countrySummaries.map((country: any) => (
            <Card key={country.countryId} className="p-4 bg-gradient-card border-border/60">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3 mb-3">
                <div>
                  <h3 className="font-semibold">{country.countryName}</h3>
                  <p className="text-xs text-muted-foreground">{country.clientCount} clientes</p>
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                {country.rows.map((row: any) => (
                  <div key={`${country.countryId}-${row.currency}`} className="space-y-2">
                    <div className="text-xs font-semibold text-primary">{row.currency}</div>
                    <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <Metric label="Facturación" value={formatMoney(row.totalBilling, row.currency)} icon={<ReceiptText className="h-3.5 w-3.5" />} />
                      <Metric label="Cobrado" value={formatMoney(row.income, row.currency)} icon={<TrendingUp className="h-3.5 w-3.5" />} />
                      <Metric label="Mora" value={formatMoney(row.overdue, row.currency)} accent={row.overdue > 0 ? "destructive" : undefined} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
                      <Metric label="Gastos" value={formatMoney(row.exp, row.currency)} icon={<TrendingDown className="h-3.5 w-3.5" />} />
                      <Metric label="Nómina" value={formatMoney(row.payroll, row.currency)} icon={<Users className="h-3.5 w-3.5" />} />
                      <Metric label="Neto" value={formatMoney(row.net, row.currency)} accent={row.net >= 0 ? "success" : "destructive"} icon={<Wallet className="h-3.5 w-3.5" />} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
          <h2 className="text-lg font-semibold">Posibles clientes</h2>
          <span className="text-xs text-muted-foreground">Valor potencial mensual a facturar</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {prospectSummary.length ? prospectSummary.map((item) => (
            <Card key={item.countryName} className="p-4 bg-gradient-card border-border/60">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3 mb-3">
                <div>
                  <h3 className="font-semibold">{item.countryName}</h3>
                  <p className="text-xs text-muted-foreground">{item.count} posibles clientes</p>
                </div>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.rows.map((row: any) => (
                  <Metric key={`${item.countryName}-${row.currency}`} label={`Potencial ${row.currency}`} value={formatMoney(row.potential, row.currency)} icon={<TrendingUp className="h-3.5 w-3.5" />} />
                ))}
              </div>
            </Card>
          )) : (
            <Card className="p-4 bg-gradient-card border-border/60 md:col-span-2 lg:col-span-4">
              <div className="text-sm text-muted-foreground">No hay posibles clientes activos para mostrar.</div>
            </Card>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 bg-gradient-card border-border/60 lg:col-span-2">
          <h3 className="font-semibold mb-3">Ingresos vs Gastos (mensual)</h3>
          {supportsCharts ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                  <Legend />
                  <Line type="monotone" dataKey="ingresos" stroke="hsl(var(--success))" strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gastos" stroke="hsl(var(--destructive))" strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {series.slice(-6).map((row: any) => (
                <Metric
                  key={row.month}
                  label={row.month}
                  value={`Ingresos ${formatMoney(row.ingresos)} · Gastos ${formatMoney(row.gastos)}`}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Gastos por categoría</h3>
          {supportsCharts ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2} isAnimationActive={false}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="space-y-2">
              {byCategory.slice(0, 6).map((item) => (
                <Metric key={item.name} label={item.name} value={formatMoney(item.value)} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Top clientes (ingresos cobrados)</h3>
          {supportsCharts ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClient} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="space-y-2">
              {byClient.slice(0, 6).map((item) => (
                <Metric key={item.name} label={item.name} value={formatMoney(item.value)} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

type MetricCardProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: "success" | "destructive";
};

const KCard = forwardRef<HTMLDivElement, MetricCardProps>(({ label, value, icon, accent, className, ...props }, ref) => {
  const accentClass = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card ref={ref} className={`p-4 bg-gradient-card border-border/60 ${className ?? ""}`.trim()} {...props}>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className={`text-xl font-semibold mt-1 font-mono ${accentClass}`}>{value}</div>
    </Card>
  );
});

KCard.displayName = "KCard";

const Metric = forwardRef<HTMLDivElement, MetricCardProps>(({ label, value, icon, accent, className, ...props }, ref) => {
  const accentClass = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div ref={ref} className={`rounded-md border border-border/60 bg-background/40 p-3 min-w-0 ${className ?? ""}`.trim()} {...props}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className={`mt-1 font-mono text-sm font-semibold truncate ${accentClass}`}>{value}</div>
    </div>
  );
});

Metric.displayName = "Metric";
