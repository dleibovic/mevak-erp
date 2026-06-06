import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CheckCircle2, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { addDaysFromFrequency, daysOverdue, fmtDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";
import { MonthlyBillingView } from "@/components/MonthlyBillingView";

export default function Billing() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { countryId } = useCountryFilter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [localCountry, setLocalCountry] = useState<string | null>(null);
  const [filterBillingUser, setFilterBillingUser] = useState<string>("all");

  useQuery({
    queryKey: ["refresh-statuses"],
    queryFn: async () => { await supabase.rpc("refresh_invoice_statuses"); return true; },
    refetchOnWindowFocus: false,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-billing"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").order("full_name")).data ?? [],
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, client:clients(id, company_name, billing_frequency, country_id, billing_user_id, country:countries(*))")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const effectiveCountry = localCountry ?? countryId;

  const markPaid = useMutation({
    mutationFn: async ({ id, collected_by }: { id: string; collected_by: "dario" | "maria" }) => {
      const { error } = await supabase.from("invoices").update({ status: "paid", collected_by, collected_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marcado como cobrado"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });

  const removeInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Factura eliminada"); qc.invalidateQueries({ queryKey: ["invoices"] }); setDeleteId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const byCountry = useMemo(
    () => effectiveCountry ? invoices.filter((i: any) => i.client?.country_id === effectiveCountry) : invoices,
    [invoices, effectiveCountry]
  );
  const byBillingUser = useMemo(() => {
    if (filterBillingUser === "all") return byCountry;
    if (filterBillingUser === "__none__") return byCountry.filter((i: any) => !i.client?.billing_user_id);
    return byCountry.filter((i: any) => i.client?.billing_user_id === filterBillingUser);
  }, [byCountry, filterBillingUser]);
  const filtered = useMemo(() => filterStatus === "all" ? byBillingUser : byBillingUser.filter((i: any) => i.status === filterStatus), [byBillingUser, filterStatus]);

  const totalsByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((i: any) => { map[i.currency] = (map[i.currency] ?? 0) + Number(i.amount || 0); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const stats = useMemo(() => {
    const overdue = byBillingUser.filter((i: any) => i.status === "overdue");
    const pending = byBillingUser.filter((i: any) => i.status === "pending");
    return { overdueCount: overdue.length, pendingCount: pending.length };
  }, [byBillingUser]);

  return (
    <PageContainer>
      <PageHeader
        title="Facturación"
        description="Cuentas corrientes, vencimientos y cobranzas"
        actions={isAdmin && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nueva factura</Button>}
      />

      <Tabs defaultValue="invoices" className="mb-4">
        <TabsList>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
          <TabsTrigger value="monthly">Facturación mensual</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly" className="mt-4">
          <MonthlyBillingView />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Facturas vencidas" value={stats.overdueCount} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <KPI label="Por vencer" value={stats.pendingCount} accent="warning" />
        <KPI label="Total facturas" value={invoices.length} />
        <KPI label="Cobradas" value={invoices.filter((i: any) => i.status === "paid").length} accent="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <Card className="p-3 mb-4 bg-gradient-card border-border/60 flex flex-wrap gap-2 items-center">
        {[
          { v: "all", l: "Todas" }, { v: "overdue", l: "Vencidas" }, { v: "pending", l: "Pendientes" }, { v: "paid", l: "Cobradas" },
        ].map(t => (
          <Button key={t.v} variant={filterStatus === t.v ? "default" : "ghost"} size="sm" onClick={() => setFilterStatus(t.v)}>{t.l}</Button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <Select value={filterBillingUser} onValueChange={setFilterBillingUser}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Responsable" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los responsables</SelectItem>
              <SelectItem value="__none__">Sin asignar</SelectItem>
              {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <CountryFilterSelect value={localCountry ?? countryId} onChange={setLocalCountry} className="w-[180px]" size="sm" />
        </div>
      </Card>

      <Card className="p-4 mb-4 bg-gradient-card border-border/60 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Total filtrado · {filtered.length} factura(s)
          {filterBillingUser !== "all" && (
            <span> · Responsable: {filterBillingUser === "__none__" ? "Sin asignar" : (profiles.find((p: any) => p.id === filterBillingUser)?.full_name ?? profiles.find((p: any) => p.id === filterBillingUser)?.email ?? "—")}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {totalsByCurrency.length ? totalsByCurrency.map(([cur, total]) => (
            <span key={cur} className="font-mono text-base font-semibold">{formatMoney(total, cur)}</span>
          )) : <span className="text-sm text-muted-foreground">Sin datos</span>}
        </div>
      </Card>

      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        {isLoading ? <div className="p-10 text-center text-muted-foreground">Cargando...</div> :
          filtered.length === 0 ? <EmptyState title="Sin facturas" description="Crea la primera factura para empezar" /> :
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cobró</TableHead>
                {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv: any) => {
                const od = inv.status === "overdue" ? daysOverdue(inv.due_date) : 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.client?.company_name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{inv.invoice_type === "formal" ? "Factura" : "Efectivo"}</Badge></TableCell>
                    <TableCell className="font-mono">{formatMoney(inv.amount, inv.currency)}</TableCell>
                    <TableCell>{fmtDate(inv.due_date)}</TableCell>
                    <TableCell>
                      {inv.status === "paid" && <Badge className="bg-success text-success-foreground hover:bg-success">Cobrada</Badge>}
                      {inv.status === "pending" && <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pendiente</Badge>}
                      {inv.status === "overdue" && <Badge variant="destructive">Vencida · {od}d</Badge>}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{inv.collected_by ?? "—"}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1 items-center justify-end flex-wrap">
                          {inv.status !== "paid" && (
                            <CollectMenu onPick={(by) => markPaid.mutate({ id: inv.id, collected_by: by })} />
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(inv); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteId(inv.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        }
      </Card>

      <InvoiceDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} editing={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && removeInvoice.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function KPI({ label, value, accent, icon }: { label: string; value: any; accent?: "destructive" | "warning" | "success"; icon?: React.ReactNode }) {
  const accentClass = accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : accent === "success" ? "text-success" : "text-foreground";
  return (
    <Card className="p-4 bg-gradient-card border-border/60">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon && <span className={accentClass}>{icon}</span>}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${accentClass}`}>{value}</div>
    </Card>
  );
}

function CollectMenu({ onPick }: { onPick: (by: "dario" | "maria") => void }) {
  return (
    <div className="inline-flex gap-1">
      <Button size="sm" variant="outline" onClick={() => onPick("dario")}>Cobró Darío</Button>
      <Button size="sm" variant="outline" onClick={() => onPick("maria")}>Cobró María</Button>
    </div>
  );
}

function InvoiceDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: any }) {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, billing_frequency, monthly_fee, fee_currency, country:countries(*)")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({ amount: 0, invoice_type: "formal" });

  // Initialize form when opening or when editing changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        client_id: editing.client_id,
        amount: editing.amount,
        invoice_type: editing.invoice_type,
        due_date: editing.due_date,
        notes: editing.notes ?? "",
        currency: editing.currency,
      });
    } else {
      setForm({ amount: 0, invoice_type: "formal" });
    }
  }, [open, editing]);

  const selectedClient = clients.find((c: any) => c.id === form.client_id);

  // Auto-fill amount with client's fee when client changes (only if creating or amount empty)
  const handleClientChange = (v: string) => {
    const c = clients.find((cl: any) => cl.id === v);
    setForm((f: any) => ({
      ...f,
      client_id: v,
      amount: c?.monthly_fee ?? f.amount ?? 0,
      currency: c?.fee_currency ?? c?.country?.currency_code ?? f.currency,
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Seleccione un cliente");
      const due = form.due_date || addDaysFromFrequency(selectedClient.billing_frequency);
      const currency = form.currency || selectedClient.fee_currency || selectedClient.country?.currency_code || "ARS";
      const payload = {
        client_id: form.client_id,
        amount: form.amount,
        currency,
        due_date: due,
        invoice_type: form.invoice_type,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Factura actualizada" : "Factura creada");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar factura" : "Nueva factura"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Cliente</Label>
            <Select value={form.client_id ?? ""} onValueChange={handleClientChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name} ({c.fee_currency ?? c.country?.currency_code})</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedClient && !editing && (
              <p className="text-xs text-muted-foreground mt-1">
                Fee del cliente: {formatMoney(selectedClient.monthly_fee, selectedClient.fee_currency ?? selectedClient.country?.currency_code)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.invoice_type} onValueChange={(v) => setForm({ ...form, invoice_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal (en blanco)</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Vencimiento {selectedClient && !editing && <span className="text-xs text-muted-foreground">(auto: {addDaysFromFrequency(selectedClient.billing_frequency)})</span>}</Label>
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.client_id || !form.amount}>{editing ? "Guardar" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
