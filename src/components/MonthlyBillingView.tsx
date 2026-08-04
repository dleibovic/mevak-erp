import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, FileCheck2, Download, FileText } from "lucide-react";
import { formatMoney, fmtDate } from "@/lib/format";
import { PAYMENT_CHANNEL_LABEL } from "@/lib/billing";
import { generateInvoicePdf } from "@/lib/invoicePdf";
import { subirDoc } from "@/lib/invoiceDocs";
import { InvoiceDocsCell } from "@/components/InvoiceDocsCell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

function periodList() {
  const now = new Date();
  const items: { value: string; label: string }[] = [];
  for (let i = -3; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    items.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    });
  }
  return items;
}

export function MonthlyBillingView() {
  const qc = useQueryClient();
  const { isAdmin, canEditAdminFinance, user } = useAuth();
  const periods = periodList();
  const currentPeriod = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const todayISO = new Date().toISOString().slice(0, 10);

  const [period, setPeriod] = useState(currentPeriod);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"none" | "channel">("channel");
  const [filterBillingUser, setFilterBillingUser] = useState<string>("all");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-billing"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").order("full_name")).data ?? [],
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["monthly_invoices", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("*, client:clients(id, company_name, payment_channel, billing_user_id), billing_user:profiles!monthly_invoices_billing_user_id_fkey(full_name, email)")
        .eq("period_month", period)
        .order("created_at", { ascending: true });
      // FK alias may not exist; fallback without join
      if (error) {
        const { data: d2, error: e2 } = await supabase
          .from("monthly_invoices")
          .select("*, client:clients(id, company_name, payment_channel, billing_user_id)")
          .eq("period_month", period);
        if (e2) throw e2;
        return d2 ?? [];
      }
      return data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("generate_monthly_invoices", { _period: period });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Facturas generadas"); qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, patch }: any) => {
      const { error } = await supabase.from("monthly_invoices").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateInvoiceDate = useMutation({
    mutationFn: async ({ id, invoice_date }: { id: string; invoice_date: string | null }) => {
      const { error } = await supabase.from("monthly_invoices").update({ invoice_date }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePaidAt = useMutation({
    mutationFn: async ({ id, paid_at }: { id: string; paid_at: string | null }) => {
      const { error } = await supabase.from("monthly_invoices").update({ paid_at }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fecha de pago actualizada"); qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const profileName = (id: string | null | undefined) => {
    if (!id) return "—";
    const p = profiles.find((x: any) => x.id === id);
    return p?.full_name ?? p?.email ?? "—";
  };



  const filtered = useMemo(() => {
    let r = rows as any[];
    if (filterStatus !== "all") r = r.filter((x) => x.status === filterStatus);
    if (filterBillingUser !== "all") {
      if (filterBillingUser === "__none__") r = r.filter((x) => !(x.billing_user_id ?? x.client?.billing_user_id));
      else r = r.filter((x) => (x.billing_user_id ?? x.client?.billing_user_id) === filterBillingUser);
    }
    if (!canEditAdminFinance) r = r.filter((x) => x.billing_user_id === user?.id);
    return r;
  }, [rows, filterStatus, filterBillingUser, canEditAdminFinance, user]);

  const stats = useMemo(() => {
    const totalsByCcy: Record<string, { total: number; pending: number; paid: number; invoiced: number }> = {};
    filtered.forEach((r: any) => {
      const c = r.currency || "ARS";
      totalsByCcy[c] ||= { total: 0, pending: 0, paid: 0, invoiced: 0 };
      const a = Number(r.amount) || 0;
      totalsByCcy[c].total += a;
      if (r.status === "pending") totalsByCcy[c].pending += a;
      if (r.status === "paid") totalsByCcy[c].paid += a;
      if (r.status === "invoiced") totalsByCcy[c].invoiced += a;
    });
    return totalsByCcy;
  }, [filtered]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "Todas", items: filtered }];
    const map = new Map<string, any[]>();
    filtered.forEach((r: any) => {
      const k = r.payment_channel ? PAYMENT_CHANNEL_LABEL[r.payment_channel] ?? r.payment_channel : "Sin canal";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered, groupBy]);

  function exportCSV() {
    const header = ["Cliente", "Canal", "Monto", "Moneda", "Estado", "Facturado", "Cobrado"];
    const lines = filtered.map((r: any) => [
      r.client?.company_name ?? "",
      r.payment_channel ? PAYMENT_CHANNEL_LABEL[r.payment_channel] ?? r.payment_channel : "",
      r.amount, r.currency, r.status,
      r.invoiced_at ? fmtDate(r.invoiced_at) : "",
      r.paid_at ? fmtDate(r.paid_at) : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `facturacion_${period}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 bg-gradient-card border-border/60 flex flex-wrap gap-2 items-center">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => <SelectItem key={p.value} value={p.value} className="capitalize">{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {[{ v: "all", l: "Todas" }, { v: "pending", l: "Pendientes" }, { v: "invoiced", l: "Facturadas" }, { v: "paid", l: "Cobradas" }, { v: "overdue", l: "Vencidas" }].map(t => (
          <Button key={t.v} variant={filterStatus === t.v ? "default" : "ghost"} size="sm" onClick={() => setFilterStatus(t.v)}>{t.l}</Button>
        ))}
        <div className="ml-auto flex gap-2">
          {canEditAdminFinance && (
            <Select value={filterBillingUser} onValueChange={setFilterBillingUser}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Responsable" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los responsables</SelectItem>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="channel">Agrupar por canal</SelectItem>
              <SelectItem value="none">Sin agrupar</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          {isAdmin && <Button size="sm" onClick={() => generate.mutate()}>Generar facturas del mes</Button>}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(stats).map(([ccy, s]) => (
          <Card key={ccy} className="p-4 bg-gradient-card border-border/60">
            <div className="text-xs text-muted-foreground">Total {ccy}</div>
            <div className="text-2xl font-semibold">{formatMoney(s.total, ccy)}</div>
            <div className="text-xs mt-1 text-muted-foreground">
              Pend: {formatMoney(s.pending, ccy)} · Cobrado: <span className="text-success">{formatMoney(s.paid, ccy)}</span>
            </div>
          </Card>
        ))}
        {Object.keys(stats).length === 0 && (
          <Card className="p-4 bg-gradient-card border-border/60 col-span-full text-sm text-muted-foreground">
            Sin facturas para el período. {isAdmin && "Usá \"Generar facturas del mes\" para crear las pendientes."}
          </Card>
        )}
      </div>

      {grouped.map((g) => (
        <Card key={g.key} className="bg-gradient-card border-border/60 overflow-hidden">
          {groupBy === "channel" && <div className="px-4 py-2 text-sm font-medium border-b border-border/60 bg-card/40">{g.key} · {g.items.length}</div>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Fecha factura</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Facturado</TableHead>
                <TableHead>Cobrado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>

            </TableHeader>
            <TableBody>
              {g.items.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.client?.company_name ?? "—"}</TableCell>
                  <TableCell>{r.payment_channel ? PAYMENT_CHANNEL_LABEL[r.payment_channel] : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-mono">{formatMoney(r.amount, r.currency)}</TableCell>
                  <TableCell>
                    {canEditAdminFinance ? (
                      <Input
                        type="date"
                        className="h-8 w-[150px]"
                        value={r.invoice_date ?? ""}
                        onChange={(e) => updateInvoiceDate.mutate({ id: r.id, invoice_date: e.target.value || null })}
                      />
                    ) : (
                      <span className="text-sm">{r.invoice_date ? fmtDate(r.invoice_date) : "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-sm ${r.due_date && r.due_date < todayISO && r.status !== "paid" ? "text-destructive font-medium" : ""}`}>
                    {r.due_date ? fmtDate(r.due_date) : "—"}
                  </TableCell>
                  <TableCell>

                    {r.status === "paid" && <Badge className="bg-success text-success-foreground hover:bg-success">Cobrada</Badge>}
                    {r.status === "invoiced" && <Badge className="bg-primary text-primary-foreground">Facturada</Badge>}
                    {r.status === "pending" && <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pendiente</Badge>}
                    {r.status === "overdue" && <Badge variant="destructive">Vencida</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{r.invoiced_at ? fmtDate(r.invoiced_at) : "—"}</TableCell>
                  <TableCell className="text-sm">{r.paid_at ? fmtDate(r.paid_at) : "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { blob, filename } = generateInvoicePdf({
                            number: `${(r.period_month ?? "").slice(0, 7)}-${(r.client?.company_name ?? "XXX").slice(0, 3).toUpperCase()}`,
                            invoiceDate: r.invoice_date ?? r.period_month,
                            dueDate: r.due_date ?? "",
                            clientName: r.client?.company_name ?? "",
                            amount: Number(r.amount || 0),
                            currency: r.currency || "USD",
                            concept: "Servicio de gestión de aplicaciones",
                          });
                          await subirDoc(r.id, blob, filename, "generated");
                          qc.invalidateQueries({ queryKey: ["invoice-docs", r.id] });
                        } catch (e: any) {
                          toast.error(e?.message ?? "Error al generar PDF");
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />PDF
                    </Button>
                    <InvoiceDocsCell invoiceId={r.id} />
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, patch: { status: "invoiced", invoiced_at: new Date().toISOString(), invoiced_by: user?.id } })}>
                        <FileCheck2 className="h-4 w-4 mr-1" />Facturada
                      </Button>
                    )}
                    {r.status !== "paid" && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: r.id, patch: { status: "paid", paid_at: new Date().toISOString(), paid_by: user?.id } })}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Cobrada
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {g.items.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sin registros</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ))}
      {isLoading && <div className="text-center text-muted-foreground py-6">Cargando…</div>}
    </div>
  );
}
