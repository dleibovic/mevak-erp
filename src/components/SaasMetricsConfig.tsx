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
  const { canEditAdminFinance } = useAuth();
  const [pausedDays, setPausedDays] = useState(60);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [cacDefault, setCacDefault] = useState(0);
  const [grossMarginDefault, setGrossMarginDefault] = useState(70);

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
      setCacDefault(Number(settings.cac_default_usd ?? 0));
      setGrossMarginDefault(Number(settings.gross_margin_default_pct ?? 70));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("app_settings")
        .upsert({
          id: 1,
          paused_to_churned_days: pausedDays,
          mrr_base_currency: baseCurrency,
          cac_default_usd: cacDefault,
          gross_margin_default_pct: grossMarginDefault,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app_settings"] }); toast.success("Configuración guardada"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 mt-4" id="saas-metrics-config">
      <Card className="p-5 bg-gradient-card border-border/60">
        <h3 className="text-lg font-semibold mb-1">Parámetros de métricas SaaS</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Estos valores se usan como <strong>fallback estimado</strong> en dashboards cuando no hay tracking real por cliente.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Días pausado → churn automático</Label>
            <Input type="number" min={1} max={365} value={pausedDays} onChange={(e) => setPausedDays(Number(e.target.value) || 60)} disabled={!canEditAdminFinance} />
            <p className="text-xs text-muted-foreground mt-1"><code>paused_to_churned_days</code></p>
          </div>
          <div>
            <Label>Moneda base MRR</Label>
            <Input value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())} disabled={!canEditAdminFinance} />
            <p className="text-xs text-muted-foreground mt-1"><code>mrr_base_currency</code></p>
          </div>
          <div>
            <Label>CAC promedio (USD) — estimado</Label>
            <Input type="number" min={0} step="0.01" value={cacDefault} onChange={(e) => setCacDefault(Number(e.target.value) || 0)} disabled={!canEditAdminFinance} />
            <p className="text-xs text-muted-foreground mt-1"><code>cac_default_usd</code></p>
          </div>
          <div>
            <Label>Margen bruto default (%) — estimado</Label>
            <Input type="number" min={0} max={100} step="0.1" value={grossMarginDefault} onChange={(e) => setGrossMarginDefault(Number(e.target.value) || 0)} disabled={!canEditAdminFinance} />
            <p className="text-xs text-muted-foreground mt-1"><code>gross_margin_default_pct</code></p>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => save.mutate()} disabled={!canEditAdminFinance || save.isPending}>Guardar</Button>
        </div>
      </Card>

      <MrrRecomputePanel />
      <ExchangeRatesAdmin />
    </div>
  );
}
