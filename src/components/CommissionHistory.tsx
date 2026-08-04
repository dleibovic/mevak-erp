import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/PageShell";
import { MonthFilter, ALL_MONTHS, currentMonthValue, monthLabel } from "@/components/MonthFilter";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Snapshot = {
  id: string;
  period_month: string;
  employee_id: string | null;
  employee_name: string;
  client_id: string | null;
  client_name: string;
  commission_value: number;
  commission_currency: string;
  billed_amount: number | null;
  billed_currency: string | null;
  was_billed: boolean;
};

type EmployeeOption = { key: string; id: string | null; name: string };

export function CommissionHistory() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState<string>(ALL_MONTHS);
  const [employeeId, setEmployeeId] = useState<string>("all");

  const { data: employees = [] } = useQuery({
    queryKey: ["commission-snapshot-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_snapshots")
        .select("employee_id, employee_name");
      if (error) throw error;
      const map = new Map<string, EmployeeOption>();
      for (const r of data ?? []) {
 1 map.set(key, { key, id: r.employee_id, name: r.employee_name });
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.key === employeeId),
    [employees, employeeId]
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["commission-snapshots", month, employeeId],
    queryFn: async () => {
      let q = supabase
        .from("commission_snapshots")
        .select("*")
        .order("period_month", { ascending: false });

      if (month !== ALL_MONTHS) {
        q = q.eq("period_month", month);
      }

      if (selectedEmployee) {
        if (selectedEmployee.id) {
          q = q.eq("employee_id", selectedEmployee.id);
        } else {
          q = q.is("employee_id", null).eq("employee_name", selectedEmployee.name);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Snapshot[];
    },
    enabled: employeeId === "all" || employees.length > 0,
  });

  const groups = useMemo(() => {
    if (selectedEmployee) {
      const map = new Map<string, { label: string; items: Snapshot[] }>();
      for (const r of rows) {
        if (!map.has(r.period_month)) {
          map.set(r.period_month, { label: monthLabel(r.period_month), items: [] });
        }
        map.get(r.period_month)!.items.push(r);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([, g]) => g);
    }

    const map = new Map<string, { label: string; items: Snapshot[] }>();
    for (const r of rows) {
      const key = r.employee_id ?? r.employee_name;
      if (!map.has(key)) {
        map.set(key, { label: r.employee_name, items: [] });
      }
      map.get(key)!.items.push(r);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
      .map(([, g]) => g);
  }, [rows, selectedEmployee]);

  const regenerate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("snapshot_commissions_for_month", { _period: currentMonthValue() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Snapshot del mes en curso regenerado");
      qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const showMonthColumn = month === ALL_MONTHS;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold">Historial de comisiones</h3>
          <p className="text-sm text-muted-foreground capitalize">
            {selectedEmployee ? selectedEmployee.name : "Todos los empleados"} · {monthLabel(month)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Empleado" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos los empleados</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.key} value={e.key}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <MonthFilter value={month} onChange={setMonth} includeAll />

          {isAdmin && (
            <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerate.isPending ? "animate-spin" : ""}`} />
              Regenerar mes actual
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : groups.length === 0 ? (
        <EmptyState title="Sin datos de comisiones para los filtros seleccionados" />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const currency = g.items[0]?.commission_currency ?? "ARS";
            const total = g.items.reduce((acc, i) => acc + Number(i.commission_value || 0), 0);
            const sinFacturar = g.items.filter((i) => !i.was_billed).length;
            return (
              <Card key={g.label} className="p-5 bg-gradient-card border-border/60">
                <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3">
                  <div>
                    <h4 className="font-semibold capitalize">{g.label}</h4>
                    {sinFacturar > 0 && (
                      <p className="text-xs text-destructive">{sinFacturar} cliente(s) sin factura</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total comisiones</div>
                    <div className="font-mono font-semibold text-primary">{formatMoney(total, currency)}</div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {showMonthColumn && <TableHead>Mes</TableHead>}
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Facturado</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((i) => (
                      <TableRow key={i.id} className={!i.was_billed ? "text-destructive" : undefined}>
                        {showMonthColumn && (
                          <TableCell className="text-sm capitalize">{monthLabel(i.period_month)}</TableCell>
                        )}
                        <TableCell>{i.client_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {i.was_billed && i.billed_amount != null
                            ? formatMoney(i.billed_amount, i.billed_currency ?? currency)
                            : "Sin factura"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(i.commission_value, i.commission_currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
