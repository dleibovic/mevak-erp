import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { daysOverdue, fmtDate, formatMoney } from "@/lib/format";

export default function Alerts() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["alerts-invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, client:clients(company_name)").neq("status", "paid").order("due_date")).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["alerts-expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").eq("recurring", true)).data ?? [],
  });

  const overdue = useMemo(() => invoices.filter((i: any) => i.status === "overdue"), [invoices]);
  const upcoming = useMemo(() => invoices.filter((i: any) => i.status === "pending" && daysOverdue(i.due_date) >= -7), [invoices]);

  return (
    <PageContainer>
      <PageHeader title="Centro de alertas" description="Vencimientos, recordatorios y avisos clave" />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-gradient-card border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Facturas vencidas ({overdue.length})</h3>
          </div>
          {overdue.length === 0 ? <p className="text-sm text-muted-foreground">Sin vencidas. ¡Excelente!</p> : (
            <div className="space-y-2">
              {overdue.map((i: any) => (
                <div key={i.id} className="flex justify-between items-center p-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <div>
                    <div className="font-medium">{i.client?.company_name}</div>
                    <div className="text-xs text-muted-foreground">Vence: {fmtDate(i.due_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{formatMoney(i.amount, i.currency)}</div>
                    <Badge variant="destructive" className="mt-1">{daysOverdue(i.due_date)} días</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 bg-gradient-card border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-warning" />
            <h3 className="font-semibold">Próximos vencimientos (7 días)</h3>
          </div>
          {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nada próximo a vencer.</p> : (
            <div className="space-y-2">
              {upcoming.map((i: any) => (
                <div key={i.id} className="flex justify-between items-center p-3 rounded-md bg-warning/10 border border-warning/30">
                  <div>
                    <div className="font-medium">{i.client?.company_name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(i.due_date)}</div>
                  </div>
                  <div className="font-mono">{formatMoney(i.amount, i.currency)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 bg-gradient-card border-border/60 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Gastos recurrentes ({expenses.length})</h3>
          </div>
          {expenses.length === 0 ? <p className="text-sm text-muted-foreground">No hay gastos recurrentes configurados.</p> : (
            <div className="grid md:grid-cols-2 gap-2">
              {expenses.map((e: any) => (
                <div key={e.id} className="flex justify-between items-center p-3 rounded-md bg-card/40 border border-border">
                  <div>
                    <div className="font-medium">{e.description}</div>
                    <div className="text-xs text-muted-foreground capitalize">{e.recurrence_frequency}</div>
                  </div>
                  <div className="font-mono text-sm">{formatMoney(e.amount, e.currency)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
