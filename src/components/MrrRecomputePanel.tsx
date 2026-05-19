import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, RotateCw, AlertTriangle } from "lucide-react";

export function MrrRecomputePanel() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [months, setMonths] = useState(24);

  const { data: runs = [] } = useQuery({
    queryKey: ["mrr-recompute-runs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mrr_recompute_runs")
        .select("*, triggered_profile:profiles!mrr_recompute_runs_triggered_by_fkey(full_name)")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) {
        const { data: d2 } = await (supabase as any)
          .from("mrr_recompute_runs").select("*").order("started_at", { ascending: false }).limit(20);
        return d2 ?? [];
      }
      return data ?? [];
    },
    refetchInterval: 3000,
  });

  const { data: pending = 0 } = useQuery({
    queryKey: ["mrr-snapshots-pending"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("mrr_snapshots").select("id", { count: "exact", head: true }).eq("needs_recompute", true);
      return count ?? 0;
    },
    refetchInterval: 5000,
  });

  const running = runs.find((r: any) => r.status === "running");

  const trigger = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("start_mrr_recompute", { _months: months });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Recálculo completado");
      qc.invalidateQueries({ queryKey: ["mrr-recompute-runs"] });
      qc.invalidateQueries({ queryKey: ["mrr-snapshots-pending"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      if (msg.includes("one_running_recompute")) toast.error("Ya hay un recálculo en curso");
      else toast.error(msg);
    },
  });

  return (
    <Card className="p-5 bg-gradient-card border-border/60 mt-4 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Recálculo de MRR histórico</h3>
          <p className="text-sm text-muted-foreground">
            Regenera los snapshots de los últimos N meses con los <code>activated_at</code> actuales y los tipos de cambio vigentes.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Meses</Label>
            <Input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(Number(e.target.value) || 24)} className="w-24" />
          </div>
          <Button onClick={() => trigger.mutate()} disabled={!isAdmin || trigger.isPending || !!running}>
            {trigger.isPending || running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}
            Recalcular MRR
          </Button>
        </div>
      </div>

      {pending > 0 && (
        <div className="flex items-center gap-2 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-md p-3">
          <AlertTriangle className="h-4 w-4" />
          {pending} snapshot{pending === 1 ? "" : "s"} pendiente{pending === 1 ? "" : "s"} de recalcular por cambios en tipos de cambio.
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-2">Historial de corridas</h4>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin corridas todavía.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Meses</TableHead>
                <TableHead>Duración total</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r: any) => {
                const dur = r.finished_at && r.started_at
                  ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 100) / 10
                  : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{r.finished_at ? new Date(r.finished_at).toLocaleString() : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "success" ? "default" : r.status === "error" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.months_processed}/{r.months_total}</TableCell>
                    <TableCell className="text-xs">{dur != null ? `${dur}s` : "—"}</TableCell>
                    <TableCell className="text-xs max-w-md truncate" title={r.error ?? JSON.stringify(r.per_month_results)}>
                      {r.error ?? `${(r.per_month_results ?? []).length} meses`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
