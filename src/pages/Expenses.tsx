import { useEffect, useState } from "react";
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
import { Plus, Trash2, Pencil, RefreshCw } from "lucide-react";
import { useExpenseCategories, useCountries } from "@/hooks/useCatalogs";
import { formatMoney, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";

export default function Expenses() {
  const qc = useQueryClient();
  const { countryId } = useCountryFilter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [localCountry, setLocalCountry] = useState<string | null>(null);
  const effectiveCountry = localCountry ?? countryId;

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", effectiveCountry],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*, category:expense_categories(name), country:countries(name, currency_code)").order("date", { ascending: false });
      if (effectiveCountry) q = q.eq("country_id", effectiveCountry);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Gasto eliminado"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  return (
    <PageContainer>
      <PageHeader title="Gastos" description="Egresos operativos y recurrentes" actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nuevo gasto</Button>} />

      <Card className="p-3 mb-4 bg-gradient-card border-border/60 flex justify-end">
        <CountryFilterSelect value={localCountry ?? countryId} onChange={setLocalCountry} className="w-[200px]" size="sm" />
      </Card>

      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        {isLoading ? <div className="p-10 text-center text-muted-foreground">Cargando...</div> :
          expenses.length === 0 ? <EmptyState title="Sin gastos cargados" /> :
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Asignado</TableHead>
                <TableHead>Pagó</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Recurrencia</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell className="text-muted-foreground">{e.category?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.country?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono">{formatMoney(e.amount, e.currency)}</TableCell>
                  <TableCell className="capitalize">{e.assigned_to}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{e.paid_by ?? "—"}</TableCell>
                  <TableCell>{fmtDate(e.date)}</TableCell>
                  <TableCell>{e.recurring ? <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" />{e.recurrence_frequency}</Badge> : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(e.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      </Card>

      <ExpenseDialog open={open} onOpenChange={setOpen} expense={editing} />
    </PageContainer>
  );
}

function ExpenseDialog({ open, onOpenChange, expense }: any) {
  const qc = useQueryClient();
  const { data: categories = [] } = useExpenseCategories();
  const { data: countries = [] } = useCountries();
  const { countryId: globalCountry } = useCountryFilter();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({ ...expense });
    } else {
      const defC = countries.find((c: any) => c.id === globalCountry) ?? countries[0];
      setForm({
        description: "",
        amount: 0,
        currency: defC?.currency_code ?? "ARS",
        country_id: defC?.id ?? null,
        assigned_to: "company",
        date: new Date().toISOString().slice(0, 10),
        recurring: false,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id, countries.length]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form }; delete payload.category; delete payload.country;
      if (!payload.recurring) payload.recurrence_frequency = null;
      if (!payload.country_id) payload.country_id = null;
      if (expense?.id) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", expense.id); if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload); if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["expenses"] }); onOpenChange(false); setForm({}); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{expense ? "Editar gasto" : "Nuevo gasto"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Descripción</Label><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={form.category_id ?? ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={form.currency ?? "ARS"} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ARS">ARS ($)</SelectItem><SelectItem value="USD">USD (US$)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>País</Label>
              <Select
                value={form.country_id ?? "none"}
                onValueChange={(v) => {
                  if (v === "none") { setForm({ ...form, country_id: null }); return; }
                  const c = countries.find((x: any) => x.id === v);
                  setForm({ ...form, country_id: v, currency: c?.currency_code ?? form.currency });
                }}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin país</SelectItem>
                  {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Monto</Label><Input type="number" step="0.01" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Fecha</Label><Input type="date" value={form.date ?? ""} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div>
              <Label>Asignado a</Label>
              <Select value={form.assigned_to ?? "company"} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dario">Darío</SelectItem><SelectItem value="maria">María</SelectItem><SelectItem value="company">Empresa</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pagado por</Label>
              <Select value={form.paid_by ?? "none"} onValueChange={(v) => setForm({ ...form, paid_by: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="dario">Darío</SelectItem><SelectItem value="maria">María</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />Gasto recurrente</label>
          {form.recurring && (
            <div>
              <Label>Frecuencia</Label>
              <Select value={form.recurrence_frequency ?? "monthly"} onValueChange={(v) => setForm({ ...form, recurrence_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensual</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.description || !form.amount}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
