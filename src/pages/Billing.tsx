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
import { Plus, CheckCircle2, AlertTriangle, Pencil, Trash2, Search, Download, Ban, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";
import { addDaysFromFrequency, daysOverdue, fmtDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";
import { MonthlyBillingView } from "@/components/MonthlyBillingView";
import { MonthFilter, currentMonthValue, monthRange } from "@/components/MonthFilter";


export default function Billing() {
  const qc = useQueryClient();
  const { isAdmin, canEditAdminFinance, user } = useAuth();
  const { countryId } = useCountryFilter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [localCountry, setLocalCountry] = useState<string | null>(null);
  const [filterBillingUser, setFilterBillingUser] = useState<string>("all");
  const [month, setMonth] = useState<string>(currentMonthValue());
  const [search, setSearch] = useState("");


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
    queryKey: ["invoices", month],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("*, client:clients(id, company_name, legal_name, billing_frequency, country_id, billing_user_id, country:countries(*)), sub_brand:client_sub_brands(id, name, legal_name)")
        .order("due_date", { ascending: true });
      const range = monthRange(month);
      if (range) q = q.gte("due_date", range.start).lt("due_date", range.end);
      const { data, error } = await q;
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

  const updateInvoiceDate = useMutation({
    mutationFn: async ({ id, invoice_date }: { id: string; invoice_date: string | null }) => {
      const { error } = await supabase.from("invoices").update({ invoice_date }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setVoid = useMutation({
    mutationFn: async ({ id, voided }: { id: string; voided: boolean }) => {
      const patch = voided
        ? { voided_at: new Date().toISOString(), voided_by: user?.id }
        : { voided_at: null, voided_by: null };
      const { error } = await supabase.from("invoices").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.voided ? "Factura anulada" : "Anulación revertida"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const entityLabel = (i: any) =>
    i.sub_brand
      ? (i.legal_name || i.sub_brand.legal_name || i.sub_brand.name)
      : (i.legal_name || i.client?.legal_name || i.client?.company_name || "—");

  const byCountry = useMemo(
    () => effectiveCountry ? invoices.filter((i: any) => i.client?.country_id === effectiveCountry) : invoices,
    [invoices, effectiveCountry]
  );
  const byBillingUser = useMemo(() => {
    if (filterBillingUser === "all") return byCountry;
    if (filterBillingUser === "__none__") return byCountry.filter((i: any) => !i.client?.billing_user_id);
    return byCountry.filter((i: any) => i.client?.billing_user_id === filterBillingUser);
  }, [byCountry, filterBillingUser]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let r = filterStatus === "all" ? byBillingUser : byBillingUser.filter((i: any) => i.status === filterStatus);
    if (s) r = r.filter((i: any) => (i.client?.company_name ?? "").toLowerCase().includes(s));
    return r;
  }, [byBillingUser, filterStatus, search]);

  function exportInvoicesExcel() {
    const rows = filtered.map((i: any) => ({
      "Cliente": i.client?.company_name ?? "",
      "Razón social / Submarca": entityLabel(i),
      "Tipo": i.invoice_type === "formal" ? "Factura" : "Efectivo",
      "Monto": Number(i.amount || 0),
      "Moneda": i.currency ?? "",
      "Fecha factura": i.invoice_date ? fmtDate(i.invoice_date) : "",
      "Vencimiento": i.due_date ? fmtDate(i.due_date) : "",
      "Estado": i.voided_at ? "Anulada" : i.status === "paid" ? "Cobrada" : i.status === "overdue" ? "Vencida" : "Pendiente",
      "Cobró": i.collected_by ?? "",
      "Fecha de cobro": i.collected_at ? fmtDate(i.collected_at) : "",
      "Notas": i.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 36 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturas");
    XLSX.writeFile(wb, `facturas-${month}.xlsx`);
  }

  const totalsByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((i: any) => { if (i.voided_at) return; map[i.currency] = (map[i.currency] ?? 0) + Number(i.amount || 0); });
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
        actions={canEditAdminFinance && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nueva factura</Button>}
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
        <div className="relative w-full sm:w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {[
          { v: "all", l: "Todas" }, { v: "overdue", l: "Vencidas" }, { v: "pending", l: "Pendientes" }, { v: "paid", l: "Cobradas" },
        ].map(t => (
          <Button key={t.v} variant={filterStatus === t.v ? "default" : "ghost"} size="sm" onClick={() => setFilterStatus(t.v)}>{t.l}</Button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <Button variant="outline" size="sm" onClick={exportInvoicesExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
          <MonthFilter value={month} onChange={setMonth} />


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
                <TableHead>Razón social / Submarca</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Fecha factura</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cobró</TableHead>
                {canEditAdminFinance && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv: any) => {
                const od = inv.status === "overdue" ? daysOverdue(inv.due_date) : 0;
                return (
                  <TableRow key={inv.id} className={inv.voided_at ? "line-through opacity-60" : ""}>
                    <TableCell className="font-medium">
                      {inv.client?.company_name}
                      {inv.sub_brand && <span className="ml-1 text-xs text-muted-foreground">· submarca</span>}
                      {inv.billing_entity_id && <span className="ml-1 text-xs text-muted-foreground">· razón social</span>}
                    </TableCell>
                    <TableCell className="text-sm">{entityLabel(inv)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{inv.invoice_type === "formal" ? "Factura" : "Efectivo"}</Badge></TableCell>
                    <TableCell className="font-mono">{formatMoney(inv.amount, inv.currency)}</TableCell>
                    <TableCell>
                      {canEditAdminFinance ? (
                        <Input type="date" className="h-8 w-[150px]" value={inv.invoice_date ?? ""}
                          onChange={(e) => updateInvoiceDate.mutate({ id: inv.id, invoice_date: e.target.value || null })} />
                      ) : (
                        <span className="text-sm">{inv.invoice_date ? fmtDate(inv.invoice_date) : "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>{fmtDate(inv.due_date)}</TableCell>
                    <TableCell>
                      {inv.voided_at ? <Badge variant="outline" className="border-destructive text-destructive">Anulada</Badge> : (<>
                      {inv.status === "paid" && <Badge className="bg-success text-success-foreground hover:bg-success">Cobrada</Badge>}
                      {inv.status === "pending" && <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pendiente</Badge>}
                      {inv.status === "overdue" && <Badge variant="destructive">Vencida · {od}d</Badge>}
                      </>)}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{inv.collected_by ?? "—"}</TableCell>
                    {canEditAdminFinance && (
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1 items-center justify-end flex-wrap">
                          {inv.status !== "paid" && !inv.voided_at && (
                            <CollectMenu onPick={(by) => markPaid.mutate({ id: inv.id, collected_by: by })} />
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(inv); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          {inv.voided_at ? (
                            <Button size="sm" variant="ghost" onClick={() => setVoid.mutate({ id: inv.id, voided: false })}><RotateCcw className="h-4 w-4 mr-1" />Restaurar</Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoid.mutate({ id: inv.id, voided: true })}><Ban className="h-4 w-4 mr-1" />Anular</Button>
                          )}
                          {isAdmin && <Button size="icon" variant="ghost" title="Eliminar definitivamente" onClick={() => setDeleteId(inv.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
        .select("id, company_name, legal_name, tax_id, billing_frequency, monthly_fee, fee_currency, country:countries(*), client_sub_brands(id, name, legal_name, tax_id, monthly_fee, fee_currency), client_billing_entities(id, legal_name, tax_id, amount, currency, active)")
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
        entity_sel: editing.billing_entity_id ? `be:${editing.billing_entity_id}` : editing.sub_brand_id ? `sb:${editing.sub_brand_id}` : "__matriz__",
        legal_name: editing.legal_name ?? "",
        tax_id: editing.tax_id ?? "",
        amount: editing.amount,
        invoice_type: editing.invoice_type,
        invoice_date: editing.invoice_date ?? "",
        due_date: editing.due_date,
        notes: editing.notes ?? "",
        currency: editing.currency,
      });
    } else {
      setForm({ amount: 0, invoice_type: "formal", entity_sel: "__matriz__" });
    }
  }, [open, editing]);

  const selectedClient = clients.find((c: any) => c.id === form.client_id);
  const subBrands = selectedClient?.client_sub_brands ?? [];
  const entities = (selectedClient?.client_billing_entities ?? []).filter((be: any) => be.active !== false);

  // Auto-fill amount with client's fee when client changes (only if creating or amount empty)
  const handleClientChange = (v: string) => {
    const c = clients.find((cl: any) => cl.id === v);
    setForm((f: any) => ({
      ...f,
      client_id: v,
      entity_sel: "__matriz__",
      legal_name: c?.legal_name ?? "",
      tax_id: c?.tax_id ?? "",
      amount: c?.monthly_fee ?? f.amount ?? 0,
      currency: c?.fee_currency ?? c?.country?.currency_code ?? f.currency,
    }));
  };

  // Elegir a qué se factura: marca (matriz), una razón social (be:) o una submarca (sb:)
  const handleEntityChange = (v: string) => {
    if (v === "__matriz__") {
      setForm((f: any) => ({ ...f, entity_sel: v, legal_name: selectedClient?.legal_name ?? "", tax_id: selectedClient?.tax_id ?? "", amount: selectedClient?.monthly_fee ?? f.amount, currency: selectedClient?.fee_currency ?? f.currency }));
    } else if (v.startsWith("be:")) {
      const be = entities.find((e: any) => e.id === v.slice(3));
      setForm((f: any) => ({ ...f, entity_sel: v, legal_name: be?.legal_name ?? "", tax_id: be?.tax_id ?? "", amount: be?.amount ?? f.amount, currency: be?.currency ?? f.currency }));
    } else {
      const sb = subBrands.find((s: any) => s.id === v.slice(3));
      setForm((f: any) => ({ ...f, entity_sel: v, legal_name: sb?.legal_name ?? sb?.name ?? "", tax_id: sb?.tax_id ?? "", amount: sb?.monthly_fee ?? f.amount, currency: sb?.fee_currency ?? f.currency }));
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Seleccione un cliente");
      const due = form.due_date || addDaysFromFrequency(selectedClient.billing_frequency);
      const currency = form.currency || selectedClient.fee_currency || selectedClient.country?.currency_code || "ARS";
      const sel: string = form.entity_sel ?? "__matriz__";
      const payload = {
        client_id: form.client_id,
        sub_brand_id: sel.startsWith("sb:") ? sel.slice(3) : null,
        billing_entity_id: sel.startsWith("be:") ? sel.slice(3) : null,
        legal_name: form.legal_name || null,
        tax_id: form.tax_id || null,
        amount: form.amount,
        currency,
        invoice_date: form.invoice_date || null,
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
          {selectedClient && (entities.length > 0 || subBrands.length > 0) && (
            <div>
              <Label>Facturar a (razón social)</Label>
              <Select value={form.entity_sel ?? "__matriz__"} onValueChange={handleEntityChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__matriz__">{selectedClient.legal_name || selectedClient.company_name} (marca)</SelectItem>
                  {entities.map((be: any) => <SelectItem key={be.id} value={`be:${be.id}`}>{be.legal_name} (razón social)</SelectItem>)}
                  {subBrands.map((sb: any) => <SelectItem key={sb.id} value={`sb:${sb.id}`}>{sb.legal_name || sb.name} (submarca)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <Label>Razón social</Label>
                <Input value={form.legal_name ?? ""} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
              </div>
              <div>
                <Label>CUIT</Label>
                <Input value={form.tax_id ?? ""} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="20-12345678-9" />
              </div>
            </div>
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
            <div>
              <Label>Fecha de facturación</Label>
              <Input type="date" value={form.invoice_date ?? ""} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
            </div>
            <div>
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
