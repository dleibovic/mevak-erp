import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/PageShell";
import { MonthFilter, currentMonthValue, monthLabel } from "@/components/MonthFilter";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Snapshot = {
  id: string;
  employee_id: string | null;
  employee_name: string;
  client_id: string | null;
  client_name: string;
  commission_value: number;
  commission_currency: string;
  billed_amount: number | null;
  billed_currency: string | null;
  was_billed: boolean;
};

export function CommissionHistory() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState<string>(currentMonthValue());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["commission-snapshots", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_snapshots")
        .select("*")
        .eq("period_month", month)
        .order("employee_name");
      if (error) throw error;
      return (data ?? []) as unknown as Snapshot[];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Snapshot[] }>();
    for (const r of rows) {
      const key = r.employee_id ?? r.employee_name;
      if (!map.has(key)) map.set(key, { name: r.employee_name, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const regenerate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("snapshot_commissions_for_month", { _period: currentMonthValue() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Snapshot del mes en curso regenerado");
      qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Historial de comisiones</h3>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthFilter value={month} onChange={setMonth} includeAll={false} />
          {isAdmin && (
            <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerate.isPending ? "animate-spin" : ""}`} />
              Regenerar mes actual
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : groups.length === 0 ? (
        <EmptyState title="Sin datos de comisiones para este mes" />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const currency = g.items[0]?.commission_currency ?? "ARS";
            const total = g.items.reduce((acc, i) => acc + Number(i.commission_value || 0), 0);
            const sinFacturar = g.items.filter((i) => !i.was_billed).length;
            return (
              <Card key={g.name} className="p-5 bg-gradient-card border-border/60">
                <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3">
                  <div>
                    <h4 className="font-semibold">{g.name}</h4>
                    {sinFacturar > 0 && (
                      <p className="text-xs text-destructive">{sinFacturar} cliente(s) sin factura este mes</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total comisiones</div>
                    <div className="font-mono font-semibold text-primary">{formatMoney(total, currency)}</div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Facturado</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((i) => (
                      <TableRow key={i.id} className={!i.was_billed ? "text-destructive" : undefined}>
                        <TableCell>{i.client_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {i.was_billed && i.billed_amount != null
                            ? formatMoney(i.billed_amount, i.billed_currency ?? currency)
                            : "Sin factura"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(i.commission_value, i.commission_currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
