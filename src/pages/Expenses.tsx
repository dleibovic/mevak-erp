import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useExpenseCategories, useCountries } from "@/hooks/useCatalogs";
import { formatMoney, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";
import { MonthFilter, currentMonthValue, monthRange } from "@/components/MonthFilter";

const FREQ_LABEL: Record<string, string> = { weekly: "Semanal", monthly: "Mensual", annual: "Anual" };

export default function Expenses() {
  const qc = useQueryClient();
  const { countryId } = useCountryFilter();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditing, setTplEditing] = useState<any>(null);
  const [localCountry, setLocalCountry] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(currentMonthValue());
  const effectiveCountry = localCountry ?? countryId;

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", effectiveCountry, month],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*, category:expense_categories(name), country:countries(name, currency_code)").order("date", { ascending: false });
      if (effectiveCountry) q = q.eq("country_id", effectiveCountry);
      const range = monthRange(month);
      if (range) q = q.gte("date", range.start).lt("date", range.end);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [], isLoading: loadingTpl } = useQuery({
    queryKey: ["expense_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_templates")
        .select("*, category:expense_categories(name), country:countries(name)")
        .order("description");
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Gasto eliminado"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  const delTpl = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expense_templates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Plantilla eliminada"); qc.invalidateQueries({ queryKey: ["expense_templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTpl = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("expense_templates").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_templates"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const period = monthRange(month)?.start ?? currentMonthValue();
      const { data, error } = await supabase.rpc("generate_recurring_expenses", { _period: period });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} gasto(s) generado(s)` : "No había gastos pendientes de generar");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader title="Gastos" description="Egresos operativos y recurrentes" />

      <Tabs defaultValue="mes">
        <TabsList className="mb-4">
          <TabsTrigger value="mes">Gastos del mes</TabsTrigger>
          <TabsTrigger value="recurrentes">Recurrentes</TabsTrigger>
        </TabsList>

        <TabsContent value="mes">
          <Card className="p-3 mb-4 bg-gradient-card border-border/60 flex flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />Generar gastos del mes
              </Button>
            )}
            <MonthFilter value={month} onChange={setMonth} />
            <CountryFilterSelect value={localCountry ?? countryId} onChange={setLocalCountry} className="w-[200px]" size="sm" />
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nuevo gasto</Button>
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
                    <TableHead>Origen</TableHead>
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
                      <TableCell>{e.template_id ? <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" />Recurrente</Badge> : <span className="text-muted-foreground">Puntual</span>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        {isAdmin && <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(e.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
          </Card>
        </TabsContent>

        <TabsContent value="recurrentes">
          <Card className="p-3 mb-4 bg-gradient-card border-border/60 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Cambiar el monto solo afecta los meses futuros que se generen; los meses ya generados conservan su monto.</p>
            <Button size="sm" onClick={() => { setTplEditing(null); setTplOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nueva plantilla</Button>
          </Card>

          <Card className="bg-gradient-card border-border/60 overflow-hidden">
            {loadingTpl ? <div className="p-10 text-center text-muted-foreground">Cargando...</div> :
              templates.length === 0 ? <EmptyState title="Sin plantillas recurrentes" /> :
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell className="text-muted-foreground">{t.category?.name ?? "—"}</TableCell>
                      <TableCell className="font-mono">{formatMoney(t.amount, t.currency)}</TableCell>
                      <TableCell>{FREQ_LABEL[t.recurrence_frequency] ?? t.recurrence_frequency}</TableCell>
                      <TableCell className="text-muted-foreground">{t.country?.name ?? "—"}</TableCell>
                      <TableCell>{fmtDate(t.start_month)}</TableCell>
                      <TableCell>
                        <Switch checked={!!t.active} onCheckedChange={(v) => toggleTpl.mutate({ id: t.id, active: v })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setTplEditing(t); setTplOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        {isAdmin && <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle><AlertDialogDescription>Los gastos ya generados se conservan, pero dejan de estar vinculados.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => delTpl.mutate(t.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
          </Card>
        </TabsContent>
      </Tabs>

      <ExpenseDialog open={open} onOpenChange={setOpen} expense={editing} />
      <TemplateDialog open={tplOpen} onOpenChange={setTplOpen} template={tplEditing} />
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
          {expense?.template_id && (
            <p className="text-xs text-muted-foreground">Instancia de un gasto recurrente: los cambios afectan solo a este mes.</p>
          )}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.description || !form.amount}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({ open, onOpenChange, template }: any) {
  const qc = useQueryClient();
  const { data: categories = [] } = useExpenseCategories();
  const { data: countries = [] } = useCountries();
  const { countryId: globalCountry } = useCountryFilter();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    if (template) {
      setForm({ ...template });
    } else {
      const defC = countries.find((c: any) => c.id === globalCountry) ?? countries[0];
      setForm({
        description: "",
        amount: 0,
        currency: defC?.currency_code ?? "ARS",
        country_id: defC?.id ?? null,
        assigned_to: "company",
        recurrence_frequency: "monthly",
        start_month: currentMonthValue(),
        active: true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id, countries.length]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        description: form.description,
        category_id: form.category_id ?? null,
        amount: Number(form.amount ?? 0),
        currency: form.currency ?? "ARS",
        assigned_to: form.assigned_to ?? "company",
        country_id: form.country_id ?? null,
        recurrence_frequency: form.recurrence_frequency ?? "monthly",
        start_month: form.start_month,
        active: !!form.active,
      };
      if (template?.id) {
        const { error } = await supabase.from("expense_templates").update(payload).eq("id", template.id); if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_templates").insert(payload); if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["expense_templates"] }); onOpenChange(false); setForm({}); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{template ? "Editar plantilla" : "Nueva plantilla recurrente"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/40 p-2">
            Cambiar el monto solo afecta los meses futuros que se generen; los meses ya generados conservan su monto.
          </p>
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
            <div>
              <Label>Asignado a</Label>
              <Select value={form.assigned_to ?? "company"} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dario">Darío</SelectItem><SelectItem value="maria">María</SelectItem><SelectItem value="company">Empresa</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frecuencia</Label>
              <Select value={form.recurrence_frequency ?? "monthly"} onValueChange={(v) => setForm({ ...form, recurrence_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensual</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mes de inicio</Label>
              <MonthFilter value={form.start_month ?? currentMonthValue()} onChange={(v) => setForm({ ...form, start_month: v })} includeAll={false} className="w-full" back={24} forward={12} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch id="tpl-active" checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label htmlFor="tpl-active">Activa</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.description || !form.amount}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
