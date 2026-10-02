import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  commission_override: number | null;
  override_note: string | null;
  source_commission_id: string | null;
  billed_amount: number | null;
  billed_currency: string | null;
  was_billed: boolean;
};

type EmployeeOption = { key: string; id: string | null; name: string };
type Grouping = "quarter" | "year";

type CommissionPayment = {
  id: string;
  employee_id: string | null;
  employee_name: string;
  period_month: string;
  amount: number;
  currency: string;
  paid_by: string;
  paid_at: string;
  expense_id: string | null;
  note: string | null;
};

const paidByLabel = (v: string) => (v === "dario" ? "Darío" : v === "maria" ? "Meri" : v);

const paymentKey = (period: string, currency: string) => `${period}|${currency}`;

const effectiveValue = (i: { commission_override?: number | null; commission_value: number }) =>
  i.commission_override ?? i.commission_value;

function totalsByCurrency(
  items?: { commission_override?: number | null; commission_value: number; commission_currency: string }[] | null,
) {
  const list = Array.isArray(items) ? items : [];
  const map = new Map<string, number>();
  for (const i of list) {
    const cur = i.commission_currency || "ARS";
    map.set(cur, (map.get(cur) ?? 0) + effectiveValue(i));
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
    for (const c of Array.isArray(current) ? current : []) {
      const key = c.employee_id ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ commission_value: Number(c.commission_value || 0), commission_currency: c.currency || "ARS" });
    }
    return map;
  }, [current]);

  if (selected) {
    return (
      <EmployeeCommissionDetail
        employee={selected}
        employees={employees}
        onSelectEmployee={setSelected}
        onBack={() => setSelected(null)}
      />
    );
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

/** Detalle por período de un grupo (trimestre/año), colapsable individualmente. */
function PeriodGroupCard({
  label,
  items,
  paymentsByKey,
}: {
  label: string;
  items: Snapshot[];
  paymentsByKey?: Map<string, CommissionPayment>;
}) {
  const list = Array.isArray(items) ? items : [];
  const sinFacturar = list.filter((i) => !i.was_billed).length;
  const months = Array.from(new Set(list.map((i) => i.period_month))).sort();
  return (
    <Collapsible>
      <Card className="p-4 bg-gradient-card border-border/60">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h5 className="font-semibold">{label}</h5>
            {paymentsByKey && months.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {months
                  .map((m) => {
                    const pays = list.filter(
                      (i) => i.period_month === m && paymentsByKey.has(paymentKey(i.period_month, i.commission_currency || "ARS")),
                    );
                    const pay = pays.length
                      ? paymentsByKey.get(paymentKey(pays[0].period_month, pays[0].commission_currency || "ARS"))
                      : undefined;
                    return pay
                      ? `${monthLabel(m)}: Pagado (${paidByLabel(pay.paid_by)})`
                      : `${monthLabel(m)}: Pendiente`;
                  })
                  .join(" · ")}
              </p>
            )}
            {sinFacturar > 0 && <p className="text-xs text-destructive">{sinFacturar} cliente(s) sin factura</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total comisiones</div>
              {totalsByCurrency(list).map(([cur, total]) => (
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
        <CollapsibleContent className="mt-3">
          <DetailTable items={list} showMonth />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function DetailTable({ items, showMonth = false }: { items: Snapshot[]; showMonth?: boolean }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const list = Array.isArray(items) ? items : [];

  const save = async (row: Snapshot, value: string, note: string) => {
    if (value.trim() === "" || Number.isNaN(Number(value))) {
      toast.error("Ingresá un valor válido");
      return false;
    }
    setSaving(true);
    const { error } = await supabase
      .from("commission_snapshots")
      .update({ commission_override: Number(value), override_note: note.trim() || null })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Comisión ajustada");
    qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
    return true;
  };

  const clear = async (row: Snapshot) => {
    setSaving(true);
    const { error } = await supabase
      .from("commission_snapshots")
      .update({ commission_override: null, override_note: null })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ajuste eliminado");
    qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showMonth && <TableHead>Mes</TableHead>}
          <TableHead>Cliente</TableHead>
          <TableHead className="text-right">Facturado</TableHead>
          <TableHead className="text-right">Comisión</TableHead>
          {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((i) => (
          <TableRow key={i.id} className={!i.was_billed ? "text-destructive" : undefined}>
            {showMonth && <TableCell className="text-sm capitalize">{monthLabel(i.period_month)}</TableCell>}
            <TableCell>{i.client_name}</TableCell>
            <TableCell className="text-right font-mono">
              {i.was_billed && i.billed_amount != null
                ? formatMoney(i.billed_amount, i.billed_currency ?? i.commission_currency)
                : "Sin factura"}
            </TableCell>
            <TableCell className="text-right">
              {i.commission_override != null ? (
                <div>
                  <div className="font-mono font-semibold text-primary">
                    {formatMoney(effectiveValue(i), i.commission_currency)}
                  </div>
                  <div className="text-xs text-muted-foreground line-through">
                    {formatMoney(i.commission_value, i.commission_currency)}
                  </div>
                  <Badge variant="outline" className="mt-1 text-xs">
                    ajustada
                  </Badge>
                  {i.override_note && <div className="text-xs text-muted-foreground mt-1">{i.override_note}</div>}
                </div>
              ) : (
                <div className="font-mono">{formatMoney(i.commission_value, i.commission_currency)}</div>
              )}
            </TableCell>
            {isAdmin && (
              <TableCell className="text-right">
                <AdjustPopover row={i} saving={saving} onSave={save} onClear={clear} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AdjustPopover({
  row,
  saving,
  onSave,
  onClear,
}: {
  row: Snapshot;
  saving: boolean;
  onSave: (row: Snapshot, value: string, note: string) => Promise<boolean>;
  onClear: (row: Snapshot) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const hasOverride = row.commission_override != null;
  const [value, setValue] = useState<string>(() => String(effectiveValue(row)));
  const [note, setNote] = useState<string>(row.override_note ?? "");

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValue(String(effectiveValue(row)));
          setNote(row.override_note ?? "");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Ajustar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Comisión ajustada</Label>
            <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nota (ej: proporcional 10 días)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                const ok = await onSave(row, value, note);
                if (ok) setOpen(false);
              }}
            >
              Guardar
            </Button>
            {hasOverride && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={async () => {
                  await onClear(row);
                  setOpen(false);
                }}
              >
                Quitar ajuste
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Nivel 2: historial del empleado, agrupado por trimestre/año (visible de entrada). */
function EmployeeCommissionDetail({
  employee,
  employees,
  onSelectEmployee,
  onBack,
}: {
  employee: EmployeeOption;
  employees: EmployeeOption[];
  onSelectEmployee: (e: EmployeeOption) => void;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { isAdmin, canEditAdminFinance } = useAuth();
  const [month, setMonth] = useState<string>(ALL_MONTHS);
  const [grouping, setGrouping] = useState<Grouping>("quarter");
  const thisMonth = currentMonthValue();

  const applyEmployee = (q: any) =>
    employee.id ? q.eq("employee_id", employee.id) : q.is("employee_id", null).eq("employee_name", employee.name);

  const { data: historyRows, isLoading } = useQuery({
    queryKey: ["commission-snapshots", employee.key, month],
    queryFn: async () => {
      let q = supabase.from("commission_snapshots").select("*").order("period_month", { ascending: false });
      if (month !== ALL_MONTHS) q = q.eq("period_month", month);
      const { data, error } = await applyEmployee(q);
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as Snapshot[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["commission-payments", employee.key],
    enabled: !!employee.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_payments").select("*").eq("employee_id", employee.id);
      if (error) throw error;
      return (data ?? []) as CommissionPayment[];
    },
  });

  const paymentsByKey = useMemo(() => {
    const map = new Map<string, CommissionPayment>();
    for (const p of payments) map.set(paymentKey(p.period_month, p.currency || "ARS"), p);
    return map;
  }, [payments]);

  const rows: Snapshot[] = Array.isArray(historyRows) ? historyRows : [];

  const periodGroups = useMemo(() => {
    const map = new Map<string, { label: string; sort: number; items: Snapshot[] }>();
    for (const r of rows) {
      const { key, label, sort } = periodKey(r.period_month, grouping);
      if (!map.has(key)) map.set(key, { label, sort, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.sort - a.sort);
  }, [rows, grouping]);

  const grandTotals = totalsByCurrency(rows);

  const regenerate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("snapshot_commissions_for_month", { _period: thisMonth });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Snapshot del mes en curso regenerado");
      qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h3 className="font-semibold">{employee.name}</h3>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerate.isPending ? "animate-spin" : ""}`} />
            Regenerar mes actual
          </Button>
        )}
      </div>

      {/* Filtros: siempre visibles */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={employee.key}
          onValueChange={(k) => {
            const next = employees.find((e) => e.key === k);
            if (next) onSelectEmployee(next);
          }}
        >
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Empleado" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {employees.map((e) => (
              <SelectItem key={e.key} value={e.key}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <MonthFilter value={month} onChange={setMonth} includeAll />

        {/* El toggle SIEMPRE está; se deshabilita cuando hay un mes puntual elegido */}
        <Tabs value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
          <TabsList className="h-9">
            <TabsTrigger value="quarter" disabled={month !== ALL_MONTHS}>
              Trimestre
            </TabsTrigger>
            <TabsTrigger value="year" disabled={month !== ALL_MONTHS}>
              Año
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Total del período mostrado</div>
          {grandTotals.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            grandTotals.map(([cur, total]) => (
              <div key={cur} className="font-mono font-semibold text-primary">
                {formatMoney(total, cur)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contenido: visible de entrada */}
      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Sin comisiones registradas para los filtros seleccionados" />
      ) : month !== ALL_MONTHS ? (
        <Card className="p-5 bg-gradient-card border-border/60">
          <h4 className="font-semibold capitalize mb-3">{monthLabel(month)}</h4>
          {canEditAdminFinance && employee.id && (
            <MonthPayments
              month={month}
              rows={rows}
              employee={employee}
              paymentsByKey={paymentsByKey}
            />
          )}
          <DetailTable items={rows} />
        </Card>
      ) : (
        <div className="space-y-3">
          {periodGroups.map((g) => (
            <PeriodGroupCard key={g.label} label={g.label} items={g.items} paymentsByKey={paymentsByKey} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Estado de pago de comisiones del mes, por moneda (solo vista de un mes). */
function MonthPayments({
  month,
  rows,
  employee,
  paymentsByKey,
}: {
  month: string;
  rows: Snapshot[];
  employee: EmployeeOption;
  paymentsByKey: Map<string, CommissionPayment>;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const billed = rows.filter((r) => r.was_billed);
  const totals = totalsByCurrency(billed);
  if (totals.length === 0) return null;

  const undo = async (paymentId: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("undo_commission_payment", { _payment_id: paymentId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pago deshecho");
    qc.invalidateQueries({ queryKey: ["commission-payments"] });
    qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
  };

  return (
    <div className="mb-4 space-y-2 rounded-md border border-border/60 p-3">
      {totals.map(([cur, total]) => {
        const payment = paymentsByKey.get(paymentKey(month, cur));
        return (
          <div key={cur} className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              A pagar: <span className="font-mono font-semibold text-primary">{formatMoney(total, cur)}</span>
            </div>
            {payment ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Pagado por {paidByLabel(payment.paid_by)} · {new Date(payment.paid_at).toLocaleDateString("es-AR")}
                </Badge>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => undo(payment.id)}>
                  Deshacer
                </Button>
              </div>
            ) : (
              <PayPopover
                disabled={busy}
                onConfirm={async (paidBy, note) => {
                  setBusy(true);
                  const { error } = await supabase.rpc("pay_commission_for_employee_month", {
                    _employee_id: employee.id,
                    _period: month,
                    _currency: cur,
                    _paid_by: paidBy,
                    _note: note || null,
                  });
                  setBusy(false);
                  if (error) {
                    toast.error(error.message);
                    return false;
                  }
                  toast.success("Comisión marcada como pagada");
                  qc.invalidateQueries({ queryKey: ["commission-payments"] });
                  qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
                  return true;
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PayPopover({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: (paidBy: "dario" | "maria", note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [paidBy, setPaidBy] = useState<string>("");
  const [note, setNote] = useState("");

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setPaidBy("");
          setNote("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Marcar como pagado
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Pagado por</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Elegí quién pagó" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dario">Darío</SelectItem>
                <SelectItem value="maria">Meri</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={disabled || !paidBy}
            onClick={async () => {
              const ok = await onConfirm(paidBy as "dario" | "maria", note.trim());
              if (ok) setOpen(false);
            }}
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
