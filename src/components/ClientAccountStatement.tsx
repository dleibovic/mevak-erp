import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney, fmtDate } from "@/lib/format";
import { PAYMENT_CHANNEL_LABEL } from "@/lib/billing";
import { evalInvoice, stateTone, totalsByCurrency, fmtPeriod, todayISO, type StmtInvoice, type StmtState } from "@/lib/accountStatement";
import { generateStatementPdf } from "@/lib/accountStatementPdf";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = { onboarding: "Onboarding", active: "Activo", paused: "Pausado", churned: "Baja" };
const FREQ_LABEL: Record<string, string> = { weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual" };

const TONE_CLASS: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
  pending: "bg-muted text-muted-foreground border-border",
  incobrable: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  void: "bg-muted/50 text-muted-foreground/70 border-border",
};

function StateBadge({ s }: { s: StmtState }) {
  return <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", TONE_CLASS[stateTone(s)])}>{s}</Badge>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );
}

export function ClientAccountStatement({ client, open, onOpenChange, billingUserName }: { client: any | null; open: boolean; onOpenChange: (v: boolean) => void; billingUserName?: string }) {
  const { isAdmin } = useAuth();
  const id = client?.id;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["client-statement-invoices", id],
    enabled: open && !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("monthly_invoices")
        .select("id, period_month, invoice_date, due_date, amount, amount_paid, currency, status, paid_at, sub_brand_id, voided_at, incobrable_at, payment_channel")
        .eq("client_id", id).order("sub_brand_id", { nullsFirst: true }).order("period_month");
      if (error) throw error;
      return data as StmtInvoice[];
    },
  });
  const { data: subBrands = [] } = useQuery({
    queryKey: ["client-statement-subbrands", id],
    enabled: open && !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("client_sub_brands").select("id, name, monthly_fee").eq("client_id", id).order("name");
      if (error) throw error;
      return data as { id: string; name: string; monthly_fee?: number | null }[];
    },
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ["client-statement-commission", id],
    enabled: open && !!id && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("client_executive_commission").select("id, commission_value, currency, employees(full_name)").eq("client_id", id);
      if (error) throw error;
      return data as any[];
    },
  });

  const today = todayISO();
  const totals = useMemo(() => totalsByCurrency(invoices, today), [invoices, today]);
  const sbMap = useMemo(() => new Map(subBrands.map((s) => [s.id, s.name])), [subBrands]);
  const weekly = client?.billing_frequency === "weekly";
  const groups = useMemo(() => {
    if (!subBrands.length) return [{ key: "", name: "", rows: invoices }];
    const keys = Array.from(new Set(invoices.map((i) => i.sub_brand_id ?? "")));
    return keys.map((k) => {
      const rows = invoices.filter((i) => (i.sub_brand_id ?? "") === k);
      return { key: k, name: sbMap.get(k) ?? "General", rows, ranges: weekly ? weeklyRangeLabels(rows.map((i) => i.period_month).sort()) : undefined };
    });
  }, [invoices, subBrands, sbMap, weekly]);
  const pagos = invoices.filter((i) => Number(i.amount_paid || 0) > 0 && !(i.voided_at && !i.incobrable_at));
  const pagosByCur = pagos.reduce<Record<string, number>>((a, i) => ((a[i.currency] = (a[i.currency] ?? 0) + Number(i.amount_paid)), a), {});

  if (!client) return null;
  const today0 = today;
  const discountVigent = client.discount_active && (!client.discount_ends_at || client.discount_ends_at >= today0);

  const download = () => {
    try { generateStatementPdf(client, invoices, subBrands); }
    catch (e: any) { toast.error(e?.message ?? "No se pudo generar el PDF"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto min-w-0">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">Cuenta corriente — {client.company_name}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <Button onClick={download} disabled={isLoading} className="w-full sm:w-auto"><Download className="h-4 w-4 mr-2" />Descargar estado de cuenta (PDF)</Button>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 [&>*]:min-w-0">
            <Field label="Empresa" value={client.company_name} />
            <Field label="Estado" value={STATUS_LABEL[client.status] ?? client.status} />
            <Field label="Fecha de inicio" value={client.activated_at ? fmtDate(client.activated_at) : "—"} />
            <Field label="País" value={client.country?.name} />
            <Field label="Ejecutivo asignado" value={client.executive?.full_name} />
            <Field label="Responsable de cobro" value={billingUserName} />
            <Field label="Fee mensual" value={formatMoney(client.monthly_fee, client.fee_currency || "USD")} />
            <Field label="Frecuencia" value={FREQ_LABEL[client.billing_frequency] ?? client.billing_frequency} />
            <Field label="Canal de cobro" value={client.payment_channel ? PAYMENT_CHANNEL_LABEL[client.payment_channel] ?? client.payment_channel : "—"} />
            <Field label="Sucursales" value={String(client.branches_count ?? 1)} />
            {discountVigent && (
              <Field label="Descuento vigente" value={`${client.discount_type === "amount" ? formatMoney(client.discount_amount, client.fee_currency || "USD") : `${client.discount_percentage}%`}${client.discount_ends_at ? ` · vence ${fmtDate(client.discount_ends_at)}` : ""}`} />
            )}
          </div>
          {isAdmin && (
            <div className="mt-4 rounded-lg border border-dashed p-3">
              <div className="text-xs font-semibold mb-1">Comisión a pagar (ejecutivo) <span className="font-normal text-muted-foreground">· interno</span></div>
              {commissions.length === 0 ? <div className="text-sm text-muted-foreground">Sin comisiones configuradas</div> : (
                <ul className="text-sm space-y-0.5">
                  {commissions.map((c) => <li key={c.id} className="break-words">{c.employees?.full_name ?? "—"}: <span className="font-medium">{formatMoney(c.commission_value, c.currency)}</span></li>)}
                </ul>
              )}
            </div>
          )}
        </Card>

        {Object.entries(totals).map(([cur, t]) => (
          <div key={cur} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 [&>*]:min-w-0">
            {[
              ["Total facturado", t.facturado, ""],
              ["Total cobrado", t.cobrado, "text-emerald-700 dark:text-emerald-400"],
              ["A vencer", t.aVencer, ""],
              ["Vencido", t.vencido, "text-destructive"],
              ...(t.incobrable > 0 ? [["Incobrable", t.incobrable, "text-amber-700 dark:text-amber-400"]] : []),
              ["Saldo total", t.saldoTotal, "text-primary"],
            ].map(([l, v, cls]) => (
              <Card key={l as string} className="p-3">
                <div className="text-[11px] text-muted-foreground">{l as string}{Object.keys(totals).length > 1 ? ` · ${cur}` : ""}</div>
                <div className={cn("text-sm font-semibold break-words", cls as string)}>{formatMoney(v as number, cur)}</div>
              </Card>
            ))}
          </div>
        ))}

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead><TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Importe</TableHead><TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead><TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>}
                {!isLoading && invoices.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin facturas</TableCell></TableRow>}
                {groups.map((g) => {
                  const subs: Record<string, number> = {};
                  const rows = g.rows.map((inv) => {
                    const { state, saldo } = evalInvoice(inv, today);
                    if (state !== "Incobrable" && state !== "Anulada") subs[inv.currency] = (subs[inv.currency] ?? 0) + saldo;
                    return (
                      <TableRow key={inv.id} className={state === "Anulada" ? "opacity-60" : ""}>
                        <TableCell className="whitespace-nowrap">{fmtPeriod(inv.period_month)}</TableCell>
                        <TableCell className="whitespace-nowrap">{inv.due_date ? fmtDate(inv.due_date) : "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatMoney(inv.amount, inv.currency)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatMoney(inv.amount_paid ?? 0, inv.currency)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{formatMoney(saldo, inv.currency)}</TableCell>
                        <TableCell><StateBadge s={state} /></TableCell>
                      </TableRow>
                    );
                  });
                  return [
                    g.name ? <TableRow key={`h-${g.key}`} className="bg-primary/10 hover:bg-primary/10"><TableCell colSpan={6} className="font-semibold text-primary">{g.name}</TableCell></TableRow> : null,
                    ...rows,
                    g.name ? (
                      <TableRow key={`s-${g.key}`} className="bg-muted/40">
                        <TableCell colSpan={4} className="text-right font-semibold">Saldo {g.name}</TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">{Object.entries(subs).map(([c, v]) => formatMoney(v, c)).join(" · ") || "—"}</TableCell>
                        <TableCell />
                      </TableRow>
                    ) : null,
                  ];
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Pagos recibidos</div>
          {pagos.length === 0 ? <div className="text-sm text-muted-foreground">Sin pagos registrados</div> : (
            <div className="space-y-1">
              {pagos.map((p) => (
                <div key={p.id} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words"><span className="text-muted-foreground">{p.paid_at ? fmtDate(p.paid_at) : "—"}</span> · Fee {fmtPeriod(p.period_month)}{p.payment_channel ? ` · ${PAYMENT_CHANNEL_LABEL[p.payment_channel] ?? p.payment_channel}` : ""}</span>
                  <span className="whitespace-nowrap font-medium">{formatMoney(p.amount_paid ?? 0, p.currency)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 text-sm font-semibold border-t pt-2 mt-2">
                <span>Total pagos</span>
                <span className="text-right">{Object.entries(pagosByCur).map(([c, v]) => formatMoney(v, c)).join(" · ")}</span>
              </div>
            </div>
          )}
        </Card>
      </DialogContent>
    </Dialog>
  );
}
