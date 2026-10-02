import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, FileCheck2, Download, FileText, Search, Ban, RotateCcw, Trash2, Pencil, Receipt, History, HandCoins } from "lucide-react";
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
  for (let i = -15; i <= 1; i++) {
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
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "channel">("channel");
  const [filterBillingUser, setFilterBillingUser] = useState<string>("all");
  // Ajustes / notas de crédito
  const [adjusting, setAdjusting] = useState<any>(null);
  const [adjKind, setAdjKind] = useState<"amount_change" | "credit_note">("amount_change");
  const [adjValue, setAdjValue] = useState<string>("");
  const [adjReason, setAdjReason] = useState<string>("");
  const [adjDate, setAdjDate] = useState<string>("");
  const [historyFor, setHistoryFor] = useState<any>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-billing"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").order("full_name")).data ?? [],
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["monthly_invoices", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("*, client:clients(id, company_name, legal_name, payment_channel, billing_user_id), sub_brand:client_sub_brands(id, name, legal_name), billing_user:profiles!monthly_invoices_billing_user_id_fkey(full_name, email)")
        .eq("period_month", period)
        .order("created_at", { ascending: true });
      if (error) {
        const { data: d2, error: e2 } = await supabase
          .from("monthly_invoices")
          .select("*, client:clients(id, company_name, legal_name, payment_channel, billing_user_id), sub_brand:client_sub_brands(id, name, legal_name)")
          .eq("period_month", period);
        if (e2) throw e2;
        return d2 ?? [];
      }
      return data ?? [];
    },
  });

  // Ajustes (editar monto / nota de crédito) de las facturas del período — para badge + registro
  const { data: adjustments = [] } = useQuery({
    queryKey: ["monthly_invoice_adjustments", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_invoice_adjustments")
        .select("*, mi:monthly_invoices!inner(period_month)")
        .eq("mi.period_month", period)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
  const adjustmentsByInvoice = useMemo(() => {
    const m = new Map<string, any[]>();
    (adjustments as any[]).forEach((a) => {
      if (!m.has(a.monthly_invoice_id)) m.set(a.monthly_invoice_id, []);
      m.get(a.monthly_invoice_id)!.push(a);
    });
    return m;
  }, [adjustments]);

  const applyAdjustment = useMutation({
    mutationFn: async () => {
      if (!adjusting) return;
      const current = Number(adjusting.amount || 0);
      const v = Number(adjValue);
      if (!adjReason.trim()) throw new Error("Indicá el motivo del ajuste");
      if (isNaN(v) || v < 0) throw new Error("Monto inválido");
      const newAmount = adjKind === "credit_note" ? Math.round((current - v) * 100) / 100 : v;
      if (newAmount < 0) throw new Error("La nota de crédito no puede superar el monto de la factura");
      const { error } = await supabase.rpc("apply_invoice_adjustment", {
        _invoice_id: adjusting.id,
        _new_amount: newAmount,
        _kind: adjKind,
        _reason: adjReason.trim(),
        _effective_date: adjDate || todayISO,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajuste aplicado");
      setAdjusting(null);
      qc.invalidateQueries({ queryKey: ["monthly_invoices"] });
      qc.invalidateQueries({ queryKey: ["monthly_invoice_adjustments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdjust = (r: any) => {
    setAdjusting(r);
    setAdjKind("amount_change");
    setAdjValue(String(r.amount ?? 0));
    setAdjReason("");
    setAdjDate(todayISO);
  };

  const generate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("generate_monthly_invoices", { _period: period });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Facturas generadas"); qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [paying, setPaying] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payChannel, setPayChannel] = useState("");
  const openPay = (r: any) => {
    setPaying(r);
    setPayAmount(String(Math.max(0, Number(r.amount) - (Number(r.amount_paid) || 0))));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayChannel(r.payment_channel ?? "");
  };
  const registrarPago = useMutation({
    mutationFn: async () => {
      const r = paying;
      const amt = Number(r.amount);
      const nuevoPagado = Math.min(amt, Number(r.amount_paid || 0) + Number(payAmount));
      const patch: any = {
        amount_paid: nuevoPagado, payment_channel: payChannel, paid_at: payDate, paid_by: user?.id,
        status: nuevoPagado >= amt ? "paid" : (r.status === "overdue" ? "overdue" : r.status),
      };
      const { error } = await supabase.from("monthly_invoices").update(patch).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pago registrado"); setPaying(null); qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
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

  const setVoid = useMutation({
    mutationFn: async ({ id, voided }: { id: string; voided: boolean }) => {
      const patch = voided
        ? { voided_at: new Date().toISOString(), voided_by: user?.id }
        : { voided_at: null, voided_by: null };
      const { error } = await supabase.from("monthly_invoices").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.voided ? "Factura anulada" : "Anulación revertida"); qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Factura eliminada"); qc.invalidateQueries({ queryKey: ["monthly_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const profileName = (id: string | null | undefined) => {
    if (!id) return "—";
    const p = profiles.find((x: any) => x.id === id);
    return p?.full_name ?? p?.email ?? "—";
  };

  // Razón social / submarca que se factura en esta fila
  const entityLabel = (r: any) =>
    r.sub_brand
      ? (r.legal_name || r.sub_brand.legal_name || r.sub_brand.name)
      : (r.legal_name || r.client?.legal_name || r.client?.company_name || "—");

  const filtered = useMemo(() => {
    let r = rows as any[];
    const s = search.trim().toLowerCase();
    if (s) r = r.filter((x) => (x.client?.company_name ?? "").toLowerCase().includes(s));
    if (filterStatus !== "all") r = r.filter((x) => x.status === filterStatus);
    if (filterBillingUser !== "all") {
      if (filterBillingUser === "__none__") r = r.filter((x) => !(x.billing_user_id ?? x.client?.billing_user_id));
      else r = r.filter((x) => (x.billing_user_id ?? x.client?.billing_user_id) === filterBillingUser);
    }
    if (!canEditAdminFinance) r = r.filter((x) => x.billing_user_id === user?.id);
    return r;
  }, [rows, search, filterStatus, filterBillingUser, canEditAdminFinance, user]);

  const stats = useMemo(() => {
    const totalsByCcy: Record<string, { total: number; pending: number; paid: number; invoiced: number }> = {};
    filtered.forEach((r: any) => {
      if (r.voided_at) return;
      const c = r.currency || "ARS";
      totalsByCcy[c] ||= { total: 0, pending: 0, paid: 0, invoiced: 0 };
      const a = Number(r.amount) || 0;
      const p = Number(r.amount_paid) || 0;
      const bal = Math.max(0, a - p);
      totalsByCcy[c].total += a;
      totalsByCcy[c].paid += p;
      if (r.status !== "paid" && bal > 0) totalsByCcy[c].pending += bal;
      if (r.status === "invoiced") totalsByCcy[c].invoiced += bal;
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
    const header = ["Cliente", "Razón social / Submarca", "Canal", "Monto", "Moneda", "Estado", "Facturado", "Cobrado por", "Fecha de pago", "Registrado"];
    const lines = filtered.map((r: any) => [
      r.client?.company_name ?? "",
      entityLabel(r),
      r.payment_channel ? PAYMENT_CHANNEL_LABEL[r.payment_channel] ?? r.payment_channel : "",
      r.amount, r.currency, r.voided_at ? "anulada" : r.status,
      r.invoiced_at ? fmtDate(r.invoiced_at) : "",
      r.paid_by ? profileName(r.paid_by) : "",
      r.paid_at ? fmtDate(r.paid_at) : "",
      r.payment_assigned_at ? fmtDate(r.payment_assigned_at) : "",
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
        <div className="relative w-full sm:w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
          {canEditAdminFinance && <Button size="sm" onClick={() => generate.mutate()}>Generar facturas del mes</Button>}
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
                <TableHead>Razón social / Submarca</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Fecha factura</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Facturado</TableHead>
                <TableHead>Cobrado por</TableHead>
                <TableHead>Fecha de pago</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.items.map((r: any) => (
                <TableRow key={r.id} className={r.voided_at ? "line-through opacity-60" : ""}>
                  <TableCell className="font-medium">
                    {r.client?.company_name ?? "—"}
                    {r.sub_brand && <span className="ml-1 text-xs text-muted-foreground">· submarca</span>}
                    {r.billing_entity_id && <span className="ml-1 text-xs text-muted-foreground">· razón social</span>}
                  </TableCell>
                  <TableCell className="text-sm">{entityLabel(r)}</TableCell>
                  <TableCell>{r.payment_channel ? PAYMENT_CHANNEL_LABEL[r.payment_channel] : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-mono">
                    {formatMoney(r.amount, r.currency)}
                    {Number(r.amount_paid) > 0 && Number(r.amount_paid) < Number(r.amount) && (
                      <div className="text-xs text-muted-foreground font-sans">
                        Cobrado {formatMoney(Number(r.amount_paid), r.currency)} · Saldo {formatMoney(Number(r.amount) - Number(r.amount_paid), r.currency)}
                      </div>
                    )}
                    {adjustmentsByInvoice.has(r.id) && (
                      <button type="button" onClick={() => setHistoryFor(r)} title="Ver registro de ajustes"
                        className="ml-1 inline-flex items-center align-middle text-primary hover:underline">
                        <History className="h-3.5 w-3.5" />
                        <span className="text-[10px] ml-0.5">{adjustmentsByInvoice.get(r.id)!.length}</span>
                      </button>
                    )}
                  </TableCell>
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
                    {r.voided_at ? <Badge variant="outline" className="border-destructive text-destructive">Anulada</Badge> : (<>
                    {r.status === "paid" && <Badge className="bg-success text-success-foreground hover:bg-success">Cobrada</Badge>}
                    {r.status === "invoiced" && <Badge className="bg-primary text-primary-foreground">Facturada</Badge>}
                    {r.status === "pending" && <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pendiente</Badge>}
                    {r.status === "overdue" && <Badge variant="destructive">Vencida</Badge>}
                    </>)}
                  </TableCell>
                  <TableCell className="text-sm">{r.invoiced_at ? fmtDate(r.invoiced_at) : "—"}</TableCell>
                  <TableCell className="text-sm">{r.paid_by ? profileName(r.paid_by) : "—"}</TableCell>
                  <TableCell>
                    {r.status === "paid" ? (
                      canEditAdminFinance ? (
                        <Input
                          type="date"
                          className="h-8 w-[150px]"
                          value={r.paid_at ? String(r.paid_at).slice(0, 10) : ""}
                          onChange={(e) => updatePaidAt.mutate({ id: r.id, paid_at: e.target.value || null })}
                        />
                      ) : (
                        <span className="text-sm">{r.paid_at ? fmtDate(r.paid_at) : "—"}</span>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.payment_assigned_at ? fmtDate(r.payment_assigned_at) : "—"}</TableCell>

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
                    {!r.voided_at && Number(r.amount) - (Number(r.amount_paid) || 0) > 0 && (
                      <Button size="sm" variant="outline" onClick={() => openPay(r)}>
                        <HandCoins className="h-4 w-4 mr-1" />Pago
                      </Button>
                    )}
                    {r.status !== "paid" && !r.voided_at && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: r.id, patch: { status: "paid", amount_paid: Number(r.amount), paid_at: r.paid_at ?? new Date().toISOString(), paid_by: user?.id } })}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Cobrada
                      </Button>
                    )}
                    {canEditAdminFinance && !r.voided_at && (
                      <Button size="sm" variant="ghost" onClick={() => openAdjust(r)} title="Editar monto o nota de crédito">
                        <Receipt className="h-4 w-4 mr-1" />Ajustar
                      </Button>
                    )}
                    {canEditAdminFinance && (
                      r.voided_at ? (
                        <Button size="sm" variant="ghost" onClick={() => setVoid.mutate({ id: r.id, voided: false })}>
                          <RotateCcw className="h-4 w-4 mr-1" />Restaurar
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoid.mutate({ id: r.id, voided: true })}>
                          <Ban className="h-4 w-4 mr-1" />Anular
                        </Button>
                      )
                    )}
                    {isAdmin && (
                      <Button size="icon" variant="ghost" title="Eliminar definitivamente"
                        onClick={() => { if (window.confirm("¿Eliminar definitivamente esta factura? Esta acción no se puede deshacer.")) removeInvoice.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {g.items.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">Sin registros</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ))}
      {isLoading && <div className="text-center text-muted-foreground py-6">Cargando…</div>}

      {/* Dialogo: registrar pago */}
      <Dialog open={!!paying} onOpenChange={(v) => !v && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago {paying?.client?.company_name ? `· ${paying.client.company_name}` : ""}</DialogTitle></DialogHeader>
          {paying && (() => {
            const amt = Number(paying.amount) || 0;
            const paid = Number(paying.amount_paid) || 0;
            const bal = amt - paid;
            const v = Number(payAmount);
            const valid = v > 0 && v <= bal + 1e-9 && !!payChannel && !!payDate;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Facturado</div><div className="font-mono">{formatMoney(amt, paying.currency)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Ya cobrado</div><div className="font-mono">{formatMoney(paid, paying.currency)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Saldo</div><div className="font-mono">{formatMoney(bal, paying.currency)}</div></div>
                </div>
                <div><Label>Monto cobrado</Label><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  {payAmount !== "" && !(v > 0 && v <= bal + 1e-9) && <p className="text-xs text-destructive mt-1">Debe ser mayor a 0 y no superar el saldo.</p>}
                </div>
                <div><Label>Fecha de pago</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
                <div><Label>Quién cobró / canal</Label>
                  <Select value={payChannel} onValueChange={setPayChannel}>
                    <SelectTrigger><SelectValue placeholder="Elegí canal" /></SelectTrigger>
                    <SelectContent>
                      {["stripe_dario", "us_dario", "dario_transferencia", "dario_efectivo", "maria_transferencia", "maria_efectivo"].map((k) => (
                        <SelectItem key={k} value={k}>{(PAYMENT_CHANNEL_LABEL as any)[k] ?? k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
                  <Button disabled={!valid || registrarPago.isPending} onClick={() => registrarPago.mutate()}>Registrar</Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialogo: ajustar monto / nota de crédito */}
      <Dialog open={!!adjusting} onOpenChange={(v) => !v && setAdjusting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar factura {adjusting?.client?.company_name ? `· ${adjusting.client.company_name}` : ""}</DialogTitle></DialogHeader>
          {adjusting && (
            <div className="grid gap-3">
              <div className="text-sm text-muted-foreground">
                Razón social: <span className="text-foreground">{entityLabel(adjusting)}</span> · Monto actual:{" "}
                <span className="font-mono text-foreground">{formatMoney(adjusting.amount, adjusting.currency)}</span>
              </div>
              <div>
                <Label>Tipo de ajuste</Label>
                <Select value={adjKind} onValueChange={(v: any) => { setAdjKind(v); setAdjValue(v === "credit_note" ? "" : String(adjusting.amount ?? 0)); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount_change">Editar monto (corrección / baja)</SelectItem>
                    <SelectItem value="credit_note">Nota de crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{adjKind === "credit_note" ? "Monto a acreditar" : "Nuevo monto"}</Label>
                <Input type="number" step="0.01" min={0} value={adjValue} onChange={(e) => setAdjValue(e.target.value)} />
                {adjKind === "credit_note" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Neto resultante:{" "}
                    <span className="font-mono">{formatMoney(Math.max(Number(adjusting.amount || 0) - (Number(adjValue) || 0), 0), adjusting.currency)}</span>
                  </p>
                )}
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} />
              </div>
              <div>
                <Label>Motivo *</Label>
                <Textarea rows={2} value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Ej: nota de crédito por descuento acordado / corrección de monto" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjusting(null)}>Cancelar</Button>
            <Button onClick={() => applyAdjustment.mutate()} disabled={applyAdjustment.isPending || !adjReason.trim() || adjValue === ""}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo: registro de ajustes de una factura */}
      <Dialog open={!!historyFor} onOpenChange={(v) => !v && setHistoryFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registro de ajustes</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {historyFor && (adjustmentsByInvoice.get(historyFor.id) ?? []).map((a: any) => (
              <div key={a.id} className="rounded-md border border-border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{a.kind === "credit_note" ? "Nota de crédito" : "Ajuste de monto"}</Badge>
                  <span className="text-xs text-muted-foreground">{a.effective_date ? fmtDate(a.effective_date) : fmtDate(a.created_at)}</span>
                </div>
                <div className="mt-1 font-mono text-xs">
                  {formatMoney(a.previous_amount ?? 0, historyFor.currency)} → {formatMoney(a.new_amount ?? 0, historyFor.currency)}
                  {a.credit_amount ? <span className="ml-1 text-destructive">(NC {formatMoney(a.credit_amount, historyFor.currency)})</span> : null}
                </div>
                {a.reason && <div className="mt-1 text-muted-foreground">{a.reason}</div>}
                <div className="mt-1 text-[11px] text-muted-foreground">Por: {profileName(a.created_by)}</div>
              </div>
            ))}
            {historyFor && (adjustmentsByInvoice.get(historyFor.id) ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">Sin ajustes.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
