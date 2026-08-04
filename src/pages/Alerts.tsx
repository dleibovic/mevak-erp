import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, RefreshCw, AlertCircle, UserX } from "lucide-react";
import { daysOverdue, fmtDate, formatMoney } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

const periodMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export default function Alerts() {
  const { isAdmin, isAdministracion } = useAuth();
  const canSeeUnbilled = isAdmin || isAdministracion;
  const period = periodMonth();

  const { data: invoices = [] } = useQuery({
    queryKey: ["alerts-invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, client:clients(company_name)").neq("status", "paid").order("due_date")).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["alerts-expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").eq("recurring", true)).data ?? [],
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["alerts-assignments"],
    enabled: canSeeUnbilled,
    queryFn: async () =>
      (await supabase
        .from("client_executive_commission")
        .select("client_id, client:clients(company_name, status), employee:employees(full_name)")).data ?? [],
  });

  const { data: periodInvoices = [] } = useQuery({
    queryKey: ["alerts-monthly-invoices", period],
    enabled: canSeeUnbilled,
    queryFn: async () =>
      (await supabase.from("monthly_invoices").select("client_id").eq("period_month", period)).data ?? [],
  });

  const unbilled = useMemo(() => {
    if (!canSeeUnbilled) return [];
    const billed = new Set(periodInvoices.map((i: any) => i.client_id));
    return assignments
      .filter((a: any) => a.client && a.client.status !== "churned" && !billed.has(a.client_id))
      .sort((a: any, b: any) =>
        (a.employee?.full_name ?? "").localeCompare(b.employee?.full_name ?? "") ||
        (a.client?.company_name ?? "").localeCompare(b.client?.company_name ?? ""));
  }, [assignments, periodInvoices, canSeeUnbilled]);

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

        {canSeeUnbilled && unbilled.length > 0 && (
          <Card className="p-5 bg-gradient-card border-border/60 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <UserX className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold">Clientes asignados sin facturar (mes actual) ({unbilled.length})</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {unbilled.map((a: any, idx: number) => (
                <div key={`${a.client_id}-${idx}`} className="flex justify-between items-center p-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <div>
                    <div className="font-medium">{a.client?.company_name}</div>
                    <div className="text-xs text-muted-foreground">Ejecutivo: {a.employee?.full_name ?? "—"}</div>
                  </div>
                  <Badge variant="outline" className="capitalize">{a.client?.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

    </PageContainer>
  );
}
