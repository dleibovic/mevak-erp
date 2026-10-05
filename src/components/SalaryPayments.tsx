import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MonthFilter, currentMonthValue } from "@/components/MonthFilter";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

type Collector = "dario" | "maria";
const PAYER: Record<Collector, string> = { dario: "Darío", maria: "Meri" };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const money = (n: number, c: string) => formatMoney(n, c as never);

export function SalaryPayments() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonthValue());
  const [target, setTarget] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [paidAt, setPaidAt] = useState(today());
  const [paidBy, setPaidBy] = useState<Collector>("dario");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active-salaries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, role, base_salary, salary_currency").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["salary_payments", month],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("salary_payments").select("*").eq("period_month", month);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const byEmp = useMemo(() => new Map(payments.map((p) => [p.employee_id, p])), [payments]);
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    payments.forEach((p) => { t[p.currency] = (t[p.currency] ?? 0) + Number(p.amount); });
    return t;
  }, [payments]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["salary_payments"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const open = (e: any) => {
    setTarget(e);
    setAmount(e.base_salary != null ? String(e.base_salary) : "");
    setCurrency(e.salary_currency || "ARS");
    setPaidAt(today()); setPaidBy("dario"); setNote("");
  };

  const confirm = async () => {
    const n = Number(amount);
    if (!(n > 0) || !paidAt) { toast.error("Ingresá un monto mayor a 0 y la fecha de pago."); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("pay_salary", {
      _employee_id: target.id, _period_month: month, _amount: n, _currency: currency,
      _paid_by: paidBy, _paid_at: paidAt, _note: note || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "No se pudo registrar el sueldo."); return; }
    toast.success("Sueldo registrado y gasto creado.");
    setTarget(null); refresh();
  };

  const undo = async (id: string) => {
    const { error } = await (supabase as any).rpc("undo_salary_payment", { _payment_id: id });
    if (error) { toast.error(error.message || "No se pudo deshacer."); return; }
    toast.success("Pago deshecho y gasto eliminado."); refresh();
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <MonthFilter value={month} onChange={setMonth} includeAll={false} />
      </div>
      <Card className="min-w-0 overflow-hidden">
        <div className="w-full min-w-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Rol</TableHead><TableHead className="text-right">Sueldo base</TableHead>
              <TableHead>Estado del mes</TableHead><TableHead className="text-right">Acción</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {employees.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin empleados activos.</TableCell></TableRow>}
              {employees.map((e: any) => {
                const p = byEmp.get(e.id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium break-words">{e.full_name}</TableCell>
                    <TableCell className="break-words">{e.role ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{e.base_salary != null ? money(Number(e.base_salary), e.salary_currency || "ARS") : "—"}</TableCell>
                    <TableCell>
                      {p ? (
                        <div className="space-y-1">
                          <Badge>Pagado</Badge>
                          <p className="text-xs text-muted-foreground break-words">Pagado el {fmtDate(p.paid_at)} · {PAYER[p.paid_by as Collector] ?? p.paid_by} · {money(Number(p.amount), p.currency)}</p>
                        </div>
                      ) : <Badge variant="outline">Pendiente</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="sm" variant="ghost">Deshacer</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Deshacer el pago?</AlertDialogTitle>
                              <AlertDialogDescription>Se borra el registro del sueldo de {e.full_name} y el gasto asociado.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => undo(p.id)}>Deshacer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : <Button size="sm" onClick={() => open(e)}>Marcar pagado</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Total pagado del mes:</span>
        {Object.keys(totals).length === 0 ? <span>—</span> : Object.entries(totals).map(([c, v]) => <span key={c} className="font-semibold">{money(v, c)}</span>)}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="min-w-0">
          <DialogHeader><DialogTitle className="break-words">Marcar pagado · {target?.full_name}</DialogTitle></DialogHeader>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div className="space-y-1"><Label htmlFor="sal-amount">Monto</Label><Input id="sal-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="sal-date">Fecha de pago</Label><Input id="sal-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
            <div className="space-y-1"><Label>Quién pagó</Label>
              <Select value={paidBy} onValueChange={(v) => setPaidBy(v as Collector)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dario">Darío</SelectItem><SelectItem value="maria">Meri</SelectItem></SelectContent></Select></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="sal-note">Nota (opcional)</Label><Input id="sal-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={confirm} disabled={saving}>{saving ? "Guardando…" : "Confirmar pago"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
