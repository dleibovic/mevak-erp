import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/PageShell";
import { MonthFilter, ALL_MONTHS, currentMonthValue, monthLabel } from "@/components/MonthFilter";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, ChevronDown } from "lucide-react";
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

type Grouping = "quarter" | "year";

function totalsByCurrency(items: Snapshot[]) {
  const map = new Map<string, number>();
  for (const i of items) {
    const cur = i.commission_currency || "ARS";
    map.set(cur, (map.get(cur) ?? 0) + Number(i.commission_value || 0));
  }
  return Array.from(map.entries());
}

function periodKey(periodMonth: string, grouping: Grouping) {
  const [y, m] = periodMonth.split("-").map(Number);
  if (grouping === "year") return { key: String(y), label: String(y), sort: y * 10 };
  const q = Math.floor((m - 1) / 3) + 1;
  return { key: `${y}-Q${q}`, label: `Q${q} ${y}`, sort: y * 10 + q };
}

export function CommissionHistory() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState<string>(ALL_MONTHS);
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [grouping, setGrouping] = useState<Grouping>("quarter");

  const { data: employees = [] } = useQuery({
    queryKey: ["commission-employee-options"],
    queryFn: async () => {
      const [emp, snaps] = await Promise.all([
        supabase.from("employees").select("id, full_name"),
        supabase.from("commission_snapshots").select("employee_id, employee_name"),
      ]);
      if (emp.error) throw emp.error;
      if (snaps.error) throw snaps.error;

      const map = new Map<string, EmployeeOption>();
      for (const e of emp.data ?? []) {
        map.set(e.id, { key: e.id, id: e.id, name: e.full_name });
      }
      const knownNames = new Set(Array.from(map.values()).map((e) => e.name));
      for (const r of (snaps.data ?? []) as { employee_id: string | null; employee_name: string }[]) {
        if (r.employee_id && map.has(r.employee_id)) continue;
        if (!r.employee_id && knownNames.has(r.employee_name)) continue;
        const key = r.employee_id ?? `name:${r.employee_name}`;
        if (!map.has(key)) map.set(key, { key, id: r.employee_id, name: r.employee_name });
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

      if (month !== ALL_MONTHS) q = q.eq("period_month", month);

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

  // Grouped view for a selected employee with "Todos los meses"
  const periodGroups = useMemo(() => {
    if (!selectedEmployee || month !== ALL_MONTHS) return [];
    const map = new Map<string, { label: string; sort: number; items: Snapshot[] }>();
    for (const r of rows) {
      const { key, label, sort } = periodKey(r.period_month, grouping);
      if (!map.has(key)) map.set(key, { label, sort, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.sort - a.sort);
  }, [rows, selectedEmployee, month, grouping]);

  // Flat groups: by employee (all employees) or single month for a selected employee
  const flatGroups = useMemo(() => {
    if (selectedEmployee && month === ALL_MONTHS) return [];
    if (selectedEmployee) {
      return rows.length ? [{ label: monthLabel(month), items: rows }] : [];
    }
    const map = new Map<string, { label: string; items: Snapshot[] }>();
    for (const r of rows) {
      const key = r.employee_id ?? r.employee_name;
      if (!map.has(key)) map.set(key, { label: r.employee_name, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, selectedEmployee, month]);

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
  const isEmpty = !isLoading && rows.length === 0;

  const detailTable = (items: Snapshot[]) => (
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
        {items.map((i) => (
          <TableRow key={i.id} className={!i.was_billed ? "text-destructive" : undefined}>
            {showMonthColumn && (
              <TableCell className="text-sm capitalize">{monthLabel(i.period_month)}</TableCell>
            )}
            <TableCell>{i.client_name}</TableCell>
            <TableCell className="text-right font-mono">
              {i.was_billed && i.billed_amount != null
                ? formatMoney(i.billed_amount, i.billed_currency ?? i.commission_currency)
                : "Sin factura"}
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatMoney(i.commission_value, i.commission_currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

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

          {selectedEmployee && month === ALL_MONTHS && (
            <Tabs value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
              <TabsList className="h-9">
                <TabsTrigger value="quarter">Trimestre</TabsTrigger>
                <TabsTrigger value="year">Año</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

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
      ) : isEmpty ? (
        <EmptyState
          title={
            selectedEmployee
              ? "Sin comisiones registradas para este empleado"
              : "Sin datos de comisiones para los filtros seleccionados"
          }
        />
      ) : periodGroups.length > 0 ? (
        <div className="space-y-3">
          {periodGroups.map((g) => {
            const sinFacturar = g.items.filter((i) => !i.was_billed).length;
            return (
              <Collapsible key={g.label}>
                <Card className="p-5 bg-gradient-card border-border/60">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h4 className="font-semibold">{g.label}</h4>
                      {sinFacturar > 0 && (
                        <p className="text-xs text-destructive">{sinFacturar} cliente(s) sin factura</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Total comisiones</div>
                        {totalsByCurrency(g.items).map(([cur, total]) => (
                          <div key={cur} className="font-mono font-semibold text-primary">
                            {formatMoney(total, cur)}
                          </div>
                        ))}
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="group">
                          Detalle
                          <ChevronDown className="h-4 w-4 ml-1 transition-transform group-data-[state=open]:rotate-180" />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="mt-3">{detailTable(g.items)}</CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {flatGroups.map((g) => {
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
                    {totalsByCurrency(g.items).map(([cur, total]) => (
                      <div key={cur} className="font-mono font-semibold text-primary">
                        {formatMoney(total, cur)}
                      </div>
                    ))}
                  </div>
                </div>
                {detailTable(g.items)}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
