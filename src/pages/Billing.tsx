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
import { Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { addDaysFromFrequency, daysOverdue, fmtDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";

export default function Billing() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { countryId } = useCountryFilter();
  const [open, setOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [localCountry, setLocalCountry] = useState<string | null>(null);

  // refresh overdue statuses on mount
  useQuery({
    queryKey: ["refresh-statuses"],
    queryFn: async () => {
      await supabase.rpc("refresh_invoice_statuses");
      return true;
    },
    refetchOnWindowFocus: false,
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, client:clients(id, company_name, billing_frequency, country_id, country:countries(*))")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // effective country = local override OR global
  const effectiveCountry = localCountry ?? countryId;

  const markPaid = useMutation({
    mutationFn: async ({ id, collected_by }: { id: string; collected_by: "dario" | "maria" }) => {
      const { error } = await supabase.from("invoices").update({ status: "paid", collected_by, collected_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marcado como cobrado"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });

  const filtered = useMemo(() => filterStatus === "all" ? invoices : invoices.filter((i: any) => i.status === filterStatus), [invoices, filterStatus]);

  const stats = useMemo(() => {
    const overdue = invoices.filter((i: any) => i.status === "overdue");
    const pending = invoices.filter((i: any) => i.status === "pending");
    return { overdueCount: overdue.length, pendingCount: pending.length };
  }, [invoices]);

  return (
    <PageContainer>
      <PageHeader
        title="Facturación"
        description="Cuentas corrientes, vencimientos y cobranzas"
        actions={isAdmin && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nueva factura</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Facturas vencidas" value={stats.overdueCount} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <KPI label="Por vencer" value={stats.pendingCount} accent="warning" />
        <KPI label="Total facturas" value={invoices.length} />
        <KPI label="Cobradas" value={invoices.filter((i: any) => i.status === "paid").length} accent="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <Card className="p-3 mb-4 bg-gradient-card border-border/60 flex gap-2">
        {[
          { v: "all", l: "Todas" }, { v: "overdue", l: "Vencidas" }, { v: "pending", l: "Pendientes" }, { v: "paid", l: "Cobradas" },
        ].map(t => (
          <Button key={t.v} variant={filterStatus === t.v ? "default" : "ghost"} size="sm" onClick={() => setFilterStatus(t.v)}>{t.l}</Button>
        ))}
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
                        {inv.status !== "paid" && (
                          <CollectMenu onPick={(by) => markPaid.mutate({ id: inv.id, collected_by: by })} />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        }
      </Card>

      <InvoiceDialog open={open} onOpenChange={setOpen} />
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

function InvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, company_name, billing_frequency, country:countries(*)").eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({ amount: 0, invoice_type: "formal" });
  const selectedClient = clients.find((c: any) => c.id === form.client_id);

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Seleccione un cliente");
      const due = form.due_date || addDaysFromFrequency(selectedClient.billing_frequency);
      const { error } = await supabase.from("invoices").insert({
        client_id: form.client_id,
        amount: form.amount,
        currency: selectedClient.country?.currency_code ?? "ARS",
        due_date: due,
        invoice_type: form.invoice_type,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Factura creada"); qc.invalidateQueries({ queryKey: ["invoices"] }); onOpenChange(false); setForm({ amount: 0, invoice_type: "formal" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Cliente</Label>
            <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name} ({c.country?.currency_code})</SelectItem>)}
              </SelectContent>
            </Select>
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
              <Label>Vencimiento {selectedClient && <span className="text-xs text-muted-foreground">(auto: {addDaysFromFrequency(selectedClient.billing_frequency)})</span>}</Label>
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
          <Button onClick={() => create.mutate()} disabled={create.isPending || !form.client_id || !form.amount}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
