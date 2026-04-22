import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCountries } from "@/hooks/useCatalogs";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

export default function Employees() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, country:countries(*), commissions:client_executive_commission(*, client:clients(company_name))")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Empleado eliminado"); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader title="Empleados" description="Equipo, sueldos y comisiones" actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nuevo empleado</Button>} />

      <div className="grid md:grid-cols-2 gap-4">
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> :
          employees.length === 0 ? <EmptyState title="Sin empleados" /> :
          employees.map((emp: any) => {
            const totalComm = emp.commissions.reduce((acc: number, c: any) => acc + Number(c.commission_value), 0);
            const total = Number(emp.base_salary || 0) + totalComm;
            return (
              <Card key={emp.id} className="p-5 bg-gradient-card border-border/60">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">{emp.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{emp.role}</p>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant={emp.is_active ? "default" : "secondary"}>{emp.is_active ? "Activo" : "Inactivo"}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(emp); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle><AlertDialogDescription>Se eliminarán también sus comisiones asociadas.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(emp.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm border-t border-border pt-3">
                  <div><div className="text-xs text-muted-foreground">Sueldo base</div><div className="font-mono">{formatMoney(emp.base_salary, emp.salary_currency)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Comisiones</div><div className="font-mono">{formatMoney(totalComm, emp.salary_currency)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Total mensual</div><div className="font-mono text-primary font-semibold">{formatMoney(total, emp.salary_currency)}</div></div>
                </div>
                {emp.commissions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2">Clientes asignados</div>
                    <div className="space-y-1">
                      {emp.commissions.map((c: any) => (
                        <div key={c.id} className="flex justify-between text-xs">
                          <span>{c.client?.company_name}</span>
                          <span className="font-mono">{formatMoney(c.commission_value, c.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
      </div>

      <EmployeeDialog open={open} onOpenChange={setOpen} employee={editing} />
    </PageContainer>
  );
}

function EmployeeDialog({ open, onOpenChange, employee }: any) {
  const qc = useQueryClient();
  const { data: countries = [] } = useCountries();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setForm(employee ?? { full_name: "", role: "", country_id: countries[0]?.id, base_salary: 0, salary_currency: "ARS", is_active: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id, countries.length]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      delete payload.country; delete payload.commissions;
      if (employee?.id) {
        const { error } = await supabase.from("employees").update(payload).eq("id", employee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["employees"] }); onOpenChange(false); setForm({}); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{employee ? "Editar empleado" : "Nuevo empleado"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nombre completo</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Rol</Label><Input value={form.role ?? ""} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ej: Ejecutiva de cuentas" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>País</Label>
              <Select value={form.country_id ?? ""} onValueChange={(v) => { const c = countries.find((x: any) => x.id === v); setForm({ ...form, country_id: v, salary_currency: c?.currency_code ?? "ARS" }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sueldo base ({form.salary_currency})</Label><Input type="number" step="0.01" value={form.base_salary ?? 0} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />Empleado activo</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.full_name}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
