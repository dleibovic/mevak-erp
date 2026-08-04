import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/PageShell";
import { MonthFilter, ALL_MONTHS, currentMonthValue, monthLabel } from "@/components/MonthFilter";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, ChevronDown, ChevronLeft } from "lucide-react";
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

function totalsByCurrency(items?: { commission_value: number; commission_currency: string }[] | null) {
  const list = Array.isArray(items) ? items : [];
  const map = new Map<string, number>();
  for (const i of list) {
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

/** Nivel 1: una fila por empleado con sus comisiones asignadas hoy. */
export function CommissionHistory() {
  const [selected, setSelected] = useState<EmployeeOption | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["commission-employee-options"],
    queryFn: async () => {
      const [emp, snaps] = await Promise.all([
        supabase.from("employees").select("id, full_name").order("full_name"),
        supabase.from("commission_snapshots").select("employee_id, employee_name"),
      ]);
      if (emp.error) throw emp.error;
      if (snaps.error) throw snaps.error;

      const map = new Map<string, EmployeeOption>();
      for (const e of emp.data ?? []) map.set(e.id, { key: e.id, id: e.id, name: e.full_name });
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

  const { data: current = [] } = useQuery({
    queryKey: ["commission-current-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_executive_commission")
        .select("employee_id, commission_value, currency, client:clients(company_name)");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const currentByEmployee = useMemo(() => {
    const map = new Map<string, { commission_value: number; commission_currency: string }[]>();
    for (const c of current) {
      const key = c.employee_id ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ commission_value: Number(c.commission_value || 0), commission_currency: c.currency || "ARS" });
    }
    return map;
  }, [current]);

  if (selected) {
    return <EmployeeCommissionDetail employee={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Historial de comisiones</h3>
        <p className="text-sm text-muted-foreground">Comisiones asignadas actualmente por empleado</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : employees.length === 0 ? (
        <EmptyState title="Sin empleados registrados" />
      ) : (
        <Card className="bg-gradient-card border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Comisiones actuales</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => {
                const items = (e.id && currentByEmployee.get(e.id)) || [];
                const totals = totalsByCurrency(items);
                return (
                  <TableRow key={e.key}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        totals.map(([cur, total]) => (
                          <div key={cur} className="text-primary font-semibold">
                            {formatMoney(total, cur)}
                          </div>
                        ))
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(e)}>
                        Detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/** Nivel 2: mes actual + historial agrupado. */
function EmployeeCommissionDetail({ employee, onBack }: { employee: EmployeeOption; onBack: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState<string>(ALL_MONTHS);
  const [grouping, setGrouping] = useState<Grouping>("quarter");
  const thisMonth = currentMonthValue();

  const applyEmployee = (q: any) =>
    employee.id ? q.eq("employee_id", employee.id) : q.is("employee_id", null).eq("employee_name", employee.name);

  // Mes actual: snapshot congelado o cálculo en vivo
  const { data: currentMonth, isLoading: loadingCurrent } = useQuery({
    queryKey: ["commission-current-month", employee.key, thisMonth],
    queryFn: async () => {
      const { data, error } = await applyEmployee(
        supabase.from("commission_snapshots").select("*").eq("period_month", thisMonth)
      );
      if (error) throw error;
      const snapRows = (Array.isArray(data) ? data : []) as unknown as Snapshot[];
      if (snapRows.length > 0) return { live: false, rows: snapRows };

      if (!employee.id) return { live: true, rows: [] as Snapshot[] };
      const { data: live, error: e2 } = await supabase
        .from("client_executive_commission")
        .select("id, client_id, commission_value, currency, client:clients(company_name)")
        .eq("employee_id", employee.id);
      if (e2) throw e2;
      const rows: Snapshot[] = (Array.isArray(live) ? live : []).map((r: any) => ({
        id: r.id,
        period_month: thisMonth,
        employee_id: employee.id,
        employee_name: employee.name,
        client_id: r.client_id,
        client_name: r.client?.company_name ?? "—",
        commission_value: Number(r.commission_value || 0),
        commission_currency: r.currency || "ARS",
        billed_amount: null,
        billed_currency: null,
        was_billed: false,
      }));
      return { live: true, rows };
    },
  });

  const cmLive = currentMonth?.live ?? false;
  const cmRows: Snapshot[] = Array.isArray(currentMonth?.rows) ? currentMonth!.rows : [];

  const { data: historyRows, isLoading } = useQuery({
    queryKey: ["commission-snapshots", employee.key, month],
    queryFn: async () => {
      let q = supabase.from("commission_snapshots").select("*").order("period_month", { ascending: false });
      if (month !== ALL_MONTHS) q = q.eq("period_month", month);
      const { data, error } = await applyEmployee(q);
      if (error) throw error;
      const rows = data ?? [];
      return (Array.isArray(rows) ? rows : []) as unknown as Snapshot[];
    },
  });

  const rows: Snapshot[] = Array.isArray(historyRows) ? historyRows : [];

  const periodGroups = useMemo(() => {
    if (month !== ALL_MONTHS) return [];
    const map = new Map<string, { label: string; sort: number; items: Snapshot[] }>();
    for (const r of rows) {
      const { key, label, sort } = periodKey(r.period_month, grouping);
      if (!map.has(key)) map.set(key, { label, sort, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.sort - a.sort);
  }, [rows, month, grouping]);

  const regenerate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("snapshot_commissions_for_month", { _period: thisMonth });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Snapshot del mes en curso regenerado");
      qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
      qc.invalidateQueries({ queryKey: ["commission-current-month"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const detailTable = (items: Snapshot[], showMonth: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          {showMonth && <TableHead>Mes</TableHead>}
          <TableHead>Cliente</TableHead>
          <TableHead className="text-right">Facturado</TableHead>
          <TableHead className="text-right">Comisión</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(Array.isArray(items) ? items : []).map((i) => (
          <TableRow key={i.id} className={!i.was_billed ? "text-destructive" : undefined}>
            {showMonth && <TableCell className="text-sm capitalize">{monthLabel(i.period_month)}</TableCell>}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h3 className="font-semibold">{employee.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{monthLabel(thisMonth)}</p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerate.isPending ? "animate-spin" : ""}`} />
            Regenerar mes actual
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MonthFilter value={month} onChange={setMonth} includeAll />
        {month === ALL_MONTHS && (
          <Tabs value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
            <TabsList className="h-9">
              <TabsTrigger value="quarter">Trimestre</TabsTrigger>
              <TabsTrigger value="year">Año</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <Card className="p-5 bg-gradient-card border-border/60">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3">
          <div>
            <h4 className="font-semibold capitalize">{monthLabel(thisMonth)}</h4>
            {cmLive && <p className="text-xs text-muted-foreground">Cálculo en vivo (mes aún no congelado)</p>}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total comisiones</div>
            {totalsByCurrency(cmRows).map(([cur, total]) => (
              <div key={cur} className="font-mono font-semibold text-primary">
                {formatMoney(total, cur)}
              </div>
            ))}
          </div>
        </div>
        {loadingCurrent ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : cmRows.length === 0 ? (
          <EmptyState title="Sin comisiones en el mes actual" />
        ) : (
          detailTable(cmRows, false)
        )}
      </Card>

      <Collapsible>
        <Card className="p-5 bg-gradient-card border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-semibold">Historial completo</h4>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="group">
                Ver
                <ChevronDown className="h-4 w-4 ml-1 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : rows.length === 0 ? (
              <EmptyState title="Sin comisiones registradas para los filtros seleccionados" />
            ) : month !== ALL_MONTHS ? (
              detailTable(rows, false)
            ) : (
              periodGroups.map((g) => {
                const sinFacturar = g.items.filter((i) => !i.was_billed).length;
                return (
                  <Collapsible key={g.label}>
                    <Card className="p-4 border-border/60">
                      <div className="flex flex-wrap justify-between items-center gap-3">
                        <div>
                          <h5 className="font-semibold">{g.label}</h5>
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
                      <CollapsibleContent className="mt-3">{detailTable(g.items, true)}</CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
