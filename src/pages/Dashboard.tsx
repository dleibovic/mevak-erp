import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { formatMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Users } from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";

const COLORS = ["hsl(35 95% 60%)", "hsl(20 90% 55%)", "hsl(145 60% 48%)", "hsl(200 80% 55%)", "hsl(280 70% 60%)", "hsl(0 75% 60%)", "hsl(50 90% 55%)", "hsl(170 70% 50%)"];

export default function Dashboard() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["dash-invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, client:clients(company_name)")).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["dash-expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*, category:expense_categories(name)")).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["dash-employees"],
    queryFn: async () => (await supabase.from("employees").select("*, commissions:client_executive_commission(commission_value, currency)")).data ?? [],
  });

  const stats = useMemo(() => {
    const sumByCurr = (rows: any[], key = "amount") => rows.reduce((acc: any, r: any) => { acc[r.currency] = (acc[r.currency] ?? 0) + Number(r[key]); return acc; }, {});
    const incomeARS = sumByCurr(invoices.filter((i: any) => i.status === "paid" && i.currency === "ARS"))["ARS"] ?? 0;
    const incomeEUR = sumByCurr(invoices.filter((i: any) => i.status === "paid" && i.currency === "EUR"))["EUR"] ?? 0;
    const expARS = sumByCurr(expenses.filter((e: any) => e.currency === "ARS"))["ARS"] ?? 0;
    const expEUR = sumByCurr(expenses.filter((e: any) => e.currency === "EUR"))["EUR"] ?? 0;
    const payrollARS = employees.reduce((acc: number, e: any) => {
      if (e.salary_currency !== "ARS") return acc;
      const comm = (e.commissions ?? []).filter((c: any) => c.currency === "ARS").reduce((a: number, c: any) => a + Number(c.commission_value), 0);
      return acc + Number(e.base_salary || 0) + comm;
    }, 0);
    const payrollEUR = employees.reduce((acc: number, e: any) => {
      if (e.salary_currency !== "EUR") return acc;
      const comm = (e.commissions ?? []).filter((c: any) => c.currency === "EUR").reduce((a: number, c: any) => a + Number(c.commission_value), 0);
      return acc + Number(e.base_salary || 0) + comm;
    }, 0);
    return { incomeARS, incomeEUR, expARS, expEUR, payrollARS, payrollEUR, netARS: incomeARS - expARS - payrollARS, netEUR: incomeEUR - expEUR - payrollEUR };
  }, [invoices, expenses, employees]);

  // Time series — paid invoices vs expenses by month
  const series = useMemo(() => {
    const map: Record<string, any> = {};
    invoices.filter((i: any) => i.status === "paid" && i.collected_at).forEach((i: any) => {
      const k = format(startOfMonth(parseISO(i.collected_at)), "yyyy-MM");
      map[k] = map[k] ?? { month: k, ingresos: 0, gastos: 0 };
      map[k].ingresos += Number(i.amount);
    });
    expenses.forEach((e: any) => {
      const k = format(startOfMonth(parseISO(e.date)), "yyyy-MM");
      map[k] = map[k] ?? { month: k, ingresos: 0, gastos: 0 };
      map[k].gastos += Number(e.amount);
    });
    return Object.values(map).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [invoices, expenses]);

  // Expense by category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const k = e.category?.name ?? "Sin categoría";
      map[k] = (map[k] ?? 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // Revenue by client
  const byClient = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.filter((i: any) => i.status === "paid").forEach((i: any) => {
      const k = i.client?.company_name ?? "—";
      map[k] = (map[k] ?? 0) + Number(i.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [invoices]);

  return (
    <PageContainer>
      <PageHeader title="Dashboard" description="Cuenta corriente general — visión consolidada" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KCard label="Ingresos ARS" value={formatMoney(stats.incomeARS, "ARS")} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <KCard label="Ingresos EUR" value={formatMoney(stats.incomeEUR, "EUR")} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <KCard label="Gastos ARS" value={formatMoney(stats.expARS, "ARS")} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
        <KCard label="Gastos EUR" value={formatMoney(stats.expEUR, "EUR")} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
        <KCard label="Nómina ARS" value={formatMoney(stats.payrollARS, "ARS")} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <KCard label="Nómina EUR" value={formatMoney(stats.payrollEUR, "EUR")} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <KCard label="Neto ARS" value={formatMoney(stats.netARS, "ARS")} accent={stats.netARS >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} />
        <KCard label="Neto EUR" value={formatMoney(stats.netEUR, "EUR")} accent={stats.netEUR >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 bg-gradient-card border-border/60 lg:col-span-2">
          <h3 className="font-semibold mb-3">Ingresos vs Gastos (mensual)</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                <Legend />
                <Line type="monotone" dataKey="ingresos" stroke="hsl(var(--success))" strokeWidth={2} />
                <Line type="monotone" dataKey="gastos" stroke="hsl(var(--destructive))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Gastos por categoría</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-card border-border/60">
          <h3 className="font-semibold mb-3">Top clientes (ingresos cobrados)</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={byClient} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function KCard({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: "success" | "destructive" }) {
  const accentClass = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card className="p-4 bg-gradient-card border-border/60">
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className={`text-xl font-semibold mt-1 font-mono ${accentClass}`}>{value}</div>
    </Card>
  );
}
