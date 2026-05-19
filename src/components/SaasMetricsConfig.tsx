import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { MrrRecomputePanel } from "@/components/MrrRecomputePanel";
import { ExchangeRatesAdmin } from "@/components/ExchangeRatesAdmin";

export function SaasMetricsConfig() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [pausedDays, setPausedDays] = useState(60);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("app_settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setPausedDays(settings.paused_to_churned_days ?? 60);
      setBaseCurrency(settings.mrr_base_currency ?? "USD");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("app_settings")
        .upsert({ id: 1, paused_to_churned_days: pausedDays, mrr_base_currency: baseCurrency, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app_settings"] }); toast.success("Configuración guardada"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-5 bg-gradient-card border-border/60">
        <h3 className="text-lg font-semibold mb-3">Parámetros de métricas SaaS</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Días pausado → churn automático</Label>
            <Input type="number" min={1} max={365} value={pausedDays} onChange={(e) => setPausedDays(Number(e.target.value) || 60)} disabled={!isAdmin} />
            <p className="text-xs text-muted-foreground mt-1">Clave: <code>app_settings.paused_to_churned_days</code></p>
          </div>
          <div>
            <Label>Moneda base MRR</Label>
            <Input value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())} disabled={!isAdmin} />
            <p className="text-xs text-muted-foreground mt-1">Clave: <code>app_settings.mrr_base_currency</code></p>
          </div>
          <div className="flex items-end">
            <Button onClick={() => save.mutate()} disabled={!isAdmin || save.isPending}>Guardar</Button>
          </div>
        </div>
      </Card>

      <MrrRecomputePanel />
      <ExchangeRatesAdmin />
    </div>
  );
}
