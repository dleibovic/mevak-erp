import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { formatMoney } from "@/lib/format";

const COLORS = ["hsl(35 95% 60%)", "hsl(20 90% 55%)", "hsl(145 60% 48%)", "hsl(200 80% 55%)", "hsl(280 70% 60%)", "hsl(0 75% 60%)"];

export default function Analytics() {
  const { data: clients = [] } = useQuery({
    queryKey: ["analytics-clients"],
    queryFn: async () => (await supabase.from("clients").select("*, executive:employees(id, full_name), client_platforms(*, platform:platforms(*)), invoices(*)")).data ?? [],
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
    <PageContainer>
      <PageHeader title="Analytics" description="Plataformas y desempeño de ejecutivos" />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
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
    </PageContainer>
  );
}
