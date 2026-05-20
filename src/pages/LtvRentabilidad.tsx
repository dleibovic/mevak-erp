import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { Info, DollarSign, Percent, Clock, TrendingUp, Settings, AlertTriangle, Coins } from "lucide-react";
import { fmtDisplay, getDisplayCurrency, getDisplayCountryName } from "@/lib/displayCurrency";

type ClientRow = {
  id: string; company_name: string; country_id: string | null;
  assigned_executive_id: string | null; food_category_id: string | null;
  status: string; activated_at: string | null; churned_at: string | null;
  monthly_fee: number; fee_currency: string; cmv_cost: number; cmv_currency: string;
  discount_active: boolean; discount_percentage: number | null; discount_ends_at: string | null;
};
type CmhRow = {
  client_id: string; snapshot_month: string;
  mrr_amount: number; mrr_amount_usd: number | null; movement_type: string;
};
type RateRow = { base_currency: string; rate: number; rate_date: string };
type AppSettings = {
  cac_default_usd: number;
  gross_margin_default_pct: number;
};

function fmtUsd(n: number) { return `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function fmtPct(n: number, d = 1) { return !isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`; }
function lastNMonths(n: number): string[] {
  const out: string[] = []; const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
}

export default function LtvRentabilidad() {
  const [country, setCountry] = useState("all");
  const [executive, setExecutive] = useState("all");
  const [foodCat, setFoodCat] = useState("all");
  const [currency, setCurrency] = useState("all");

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("app_settings").select("cac_default_usd, gross_margin_default_pct").eq("id", 1).maybeSingle();
      return (data ?? { cac_default_usd: 0, gross_margin_default_pct: 70 }) as AppSettings;
    },
  });
  const cacDefault = Number(settings?.cac_default_usd ?? 0);
  const grossMarginDefault = Number(settings?.gross_margin_default_pct ?? 70) / 100;

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-ltv"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, country_id, assigned_executive_id, food_category_id, status, activated_at, churned_at, monthly_fee, fee_currency, cmv_cost, cmv_currency, discount_active, discount_percentage, discount_ends_at");
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: cmh = [] } = useQuery({
    queryKey: ["cmh-ltv-24m"],
    queryFn: async () => {
      const oldest = lastNMonths(24)[0];
      const { data } = await (supabase as any)
        .from("client_mrr_history")
        .select("client_id, snapshot_month, mrr_amount, mrr_amount_usd, movement_type")
        .gte("snapshot_month", oldest);
      return (data ?? []) as CmhRow[];
    },
  });

  const { data: rates = [] } = useQuery({
    queryKey: ["latest-rates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("base_currency, rate, rate_date")
        .order("rate_date", { ascending: false });
      return (data ?? []) as RateRow[];
    },
  });

  const { data: countries = [] } = useQuery({
    queryKey: ["countries-cc"],
    queryFn: async () => (await supabase.from("countries").select("id, name, currency_code")).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-with-salary"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name, base_salary, salary_currency, is_active")).data ?? [],
  });
  const { data: foodCategories = [] } = useQuery({
    queryKey: ["food-categories"],
    queryFn: async () => (await supabase.from("food_categories").select("id, name")).data ?? [],
  });
  const { data: commissionRows = [] } = useQuery({
    queryKey: ["client-exec-commissions"],
    queryFn: async () => (await (supabase as any).from("client_executive_commission").select("client_id, employee_id, commission_value, currency")).data ?? [],
  });

  const latestRate = useMemo(() => {
    const m = new Map<string, number>();
    rates.forEach((r) => { if (!m.has(r.base_currency)) m.set(r.base_currency, Number(r.rate)); });
    return m;
  }, [rates]);

  const toUsd = (amount: number, ccy: string) => {
    if (!amount) return 0;
    if (ccy === "USD") return amount;
    const r = latestRate.get(ccy);
    if (!r || r === 0) return 0;
    return amount / r;
  };

  const currenciesAvailable = useMemo(() => {
    const s = new Set<string>(); clients.forEach((c) => s.add(c.fee_currency));
    return Array.from(s).sort();
  }, [clients]);

  const filteredClients = useMemo(() => clients.filter((c) => {
    if (country !== "all" && c.country_id !== country) return false;
    if (executive !== "all" && c.assigned_executive_id !== executive) return false;
    if (foodCat !== "all" && c.food_category_id !== foodCat) return false;
    if (currency !== "all" && c.fee_currency !== currency) return false;
    return true;
  }), [clients, country, executive, foodCat, currency]);

  const cmhByClient = useMemo(() => {
    const m = new Map<string, CmhRow[]>();
    cmh.forEach((r) => { if (!m.has(r.client_id)) m.set(r.client_id, []); m.get(r.client_id)!.push(r); });
    return m;
  }, [cmh]);

  const today = new Date();
  const perClient = useMemo(() => {
    return filteredClients.map((c) => {
      const effectiveFee = c.discount_active && c.discount_percentage
        ? c.monthly_fee * (1 - Number(c.discount_percentage) / 100)
        : c.monthly_fee;
      const feeUsd = toUsd(Number(effectiveFee || 0), c.fee_currency);
      const cmvUsd = toUsd(Number(c.cmv_cost || 0), c.cmv_currency);
      const hasCmv = Number(c.cmv_cost || 0) > 0;
      const marginUsd = feeUsd - cmvUsd;
      const marginPct = feeUsd > 0 ? marginUsd / feeUsd : 0;

      const start = c.activated_at ? new Date(c.activated_at) : null;
      const end = c.churned_at ? new Date(c.churned_at) : today;
      const activeMonths = start
        ? Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1)
        : 0;

      const rows = cmhByClient.get(c.id) ?? [];
      const historicalLtvUsd = rows.reduce((s, r) => r.movement_type === "churn" ? s : s + Number(r.mrr_amount_usd || 0), 0);

      return { id: c.id, name: c.company_name, status: c.status, activeMonths, feeUsd, cmvUsd, hasCmv, marginPct, marginUsd, historicalLtvUsd };
    });
  }, [filteredClients, cmhByClient, latestRate]);

  const active = perClient.filter((p) => p.status === "active");
  const totalMrrUsd = active.reduce((s, p) => s + p.feeUsd, 0);

  // Real margin: only over clients with cmv_cost > 0
  const withCmv = active.filter((p) => p.hasCmv);
  const mrrWithCmv = withCmv.reduce((s, p) => s + p.feeUsd, 0);
  const cmvWithCmv = withCmv.reduce((s, p) => s + p.cmvUsd, 0);
  const realMarginPct = mrrWithCmv > 0 ? (mrrWithCmv - cmvWithCmv) / mrrWithCmv : 0;
  const cmvCoverage = totalMrrUsd > 0 ? mrrWithCmv / totalMrrUsd : 0;

  // Effective margin used in LTV: real if coverage >= 80%, otherwise default from settings
  const usingRealMargin = cmvCoverage >= 0.8;
  const effectiveMarginPct = usingRealMargin ? realMarginPct : grossMarginDefault;

  const arpa = active.length > 0 ? totalMrrUsd / active.length : 0;

  // Logo churn 12m
  const months12 = useMemo(() => lastNMonths(12), []);
  const { churned12, base12 } = useMemo(() => {
    const filteredIds = new Set(filteredClients.map((c) => c.id));
    const churnEvents = cmh.filter((r) => r.movement_type === "churn" && filteredIds.has(r.client_id) && r.snapshot_month >= months12[0]);
    const baseMonth = months12[0];
    const baseActive = new Set<string>();
    cmh.forEach((r) => {
      if (r.snapshot_month === baseMonth && r.movement_type !== "churn" && r.mrr_amount > 0 && filteredIds.has(r.client_id)) {
        baseActive.add(r.client_id);
      }
    });
    return { churned12: churnEvents.length, base12: baseActive.size };
  }, [cmh, filteredClients, months12]);

  const annualLogoChurn = base12 > 0 ? Math.min(1, churned12 / base12) : 0;
  const ltvSimple = annualLogoChurn > 0 ? (arpa * 12) / annualLogoChurn : 0;
  const ltvMargin = ltvSimple * effectiveMarginPct;

  const cac = cacDefault;
  const ltvCacRatio = cac > 0 ? ltvMargin / cac : 0;
  const paybackMonths = arpa > 0 && effectiveMarginPct > 0 ? cac / (arpa * effectiveMarginPct) : 0;

  const marginBuckets = useMemo(() => {
    const buckets = [
      { range: "Sin CMV", min: NaN, max: NaN, count: 0 },
      { range: "<0%", min: -Infinity, max: 0, count: 0 },
      { range: "0-25%", min: 0, max: 0.25, count: 0 },
      { range: "25-50%", min: 0.25, max: 0.5, count: 0 },
      { range: "50-75%", min: 0.5, max: 0.75, count: 0 },
      { range: "75-100%", min: 0.75, max: 1.01, count: 0 },
    ];
    active.forEach((p) => {
      if (!p.hasCmv) { buckets[0].count += 1; return; }
      const b = buckets.find((x) => !isNaN(x.min) && p.marginPct >= x.min && p.marginPct < x.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [active]);

  const scatterData = active.filter((p) => p.hasCmv).map((p) => ({
    x: p.marginPct * 100, y: p.historicalLtvUsd, z: p.feeUsd, name: p.name,
  }));

  const topMargin = [...active].filter((p) => p.hasCmv).sort((a, b) => b.marginUsd - a.marginUsd).slice(0, 10);
  const bottomMargin = [...active].filter((p) => p.hasCmv && p.feeUsd > 0).sort((a, b) => a.marginPct - b.marginPct).slice(0, 10);

  return (
    <TooltipProvider delayDuration={200}>
      <PageContainer>
        <PageHeader
          title="LTV & Rentabilidad"
          description="Cada KPI marcado como estimado depende de parámetros configurables o de tracking que aún no está implementado."
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-44"><SelectValue placeholder="País" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los países</SelectItem>
              {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={executive} onValueChange={setExecutive}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los ejecutivos</SelectItem>
              {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={foodCat} onValueChange={setFoodCat}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {foodCategories.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Moneda" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              {currenciesAvailable.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Data-quality legend */}
        <Card className="p-3 border-border/60 bg-muted/30 text-xs space-y-1">
          <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Leyenda de calidad de datos</div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1"><Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">REAL</Badge> Calculado con datos del ERP.</span>
            <span className="inline-flex items-center gap-1"><Badge variant="outline" className="border-amber-500 text-amber-600">CONFIG</Badge> Usa parámetro configurable en admin.</span>
            <span className="inline-flex items-center gap-1"><Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">ESTIMADO</Badge> Requiere tracking aún no implementado.</span>
          </div>
        </Card>

        {/* Section 1: Volumen y churn (REAL) */}
        <SectionTitle title="Volumen y churn" subtitle="Datos reales del ERP" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label="MRR activo (USD)"
            value={fmtUsd(totalMrrUsd)}
            sub={`${active.length} clientes activos`}
            tag="real"
            tooltip="Suma de monthly_fee efectivo (con descuento activo) de clientes con status='active', convertido a USD al rate canónico más reciente por moneda."
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label="ARPA (USD)"
            value={fmtUsd(arpa)}
            sub="MRR / clientes activos"
            tag="real"
            tooltip="MRR activo USD / cantidad de clientes activos. No incluye clientes pausados ni churned."
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Logo Churn anual"
            value={fmtPct(annualLogoChurn)}
            sub={`${churned12} churned / base ${base12}`}
            tag="real"
            tooltip="Churn cohort real últimos 12 meses: clientes que pasaron a 'churned' en los últimos 12m / clientes activos al inicio del período. No es lineal × 12."
          />
          <KpiCard
            label="LTV simple (USD)"
            value={fmtUsd(ltvSimple)}
            sub="(ARPA · 12) / churn anual"
            tag="real"
            tooltip="Fórmula clásica: ingreso anual promedio dividido la tasa de churn anual. No incluye margen — bruto sobre el revenue, no sobre el beneficio."
          />
        </div>

        {/* Section 2: Rentabilidad (mixed) */}
        <SectionTitle
          title="Rentabilidad"
          subtitle={
            usingRealMargin
              ? `Margen calculado sobre ${withCmv.length} clientes con CMV cargado (${fmtPct(cmvCoverage, 0)} del MRR).`
              : `Cobertura de CMV insuficiente (${fmtPct(cmvCoverage, 0)} del MRR). Se usa el margen default de admin.`
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margen bruto real"
            value={fmtPct(realMarginPct)}
            sub={`(MRR − CMV) / MRR · ${withCmv.length} clientes`}
            tag="real"
            tooltip={`Fórmula: (Σ monthly_fee USD − Σ cmv_cost USD) / Σ monthly_fee USD, solo clientes con cmv_cost > 0. Cobertura: ${fmtPct(cmvCoverage, 0)} del MRR total. CMV se convierte con el tipo de cambio más reciente (no hay histórico de CMV).`}
          />
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margen default"
            value={fmtPct(grossMarginDefault, 0)}
            sub="Valor configurable en admin"
            tag="config"
            adminAnchor="saas-metrics-config"
            tooltip="Margen bruto estimado usado como fallback cuando no hay suficiente cobertura de CMV. Editable en /admin → Parámetros de métricas SaaS → gross_margin_default_pct."
          />
          <KpiCard
            label={`Margen efectivo (usado en LTV)`}
            value={fmtPct(effectiveMarginPct)}
            sub={usingRealMargin ? "= margen real" : "= margen default (cobertura <80%)"}
            tag={usingRealMargin ? "real" : "config"}
            adminAnchor={usingRealMargin ? undefined : "saas-metrics-config"}
            tooltip="Si la cobertura de CMV supera el 80% del MRR, se usa el margen real; sino, el margen default configurable."
          />
          <KpiCard
            label="LTV con margen"
            value={fmtUsd(ltvMargin)}
            sub={`LTV simple · margen efectivo`}
            tag="estimated"
            tooltip="LTV simple multiplicado por el margen efectivo. No incluye costo de servicing real por cliente (time tracking aún no implementado). Cuando se sume tracking de horas, este número va a bajar y ser más preciso."
          />
        </div>

        {/* Section 3: CAC & ratios (CONFIG + ESTIMATED) */}
        <SectionTitle title="Adquisición y eficiencia" subtitle="Depende de parámetros configurables. Recalcular cuando se sume tracking real de costos de adquisición." />
        <Card className="p-3 border-amber-500/40 bg-amber-500/5 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            Los KPIs siguientes son <strong>estimados</strong>. CAC es un valor manual cargado en admin
            (no hay tracking automático de costo por adquisición). LTV/CAC y Payback heredan esa estimación
            y la del margen efectivo.
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label="CAC promedio (USD)"
            value={cac > 0 ? fmtUsd(cac) : "— no cargado"}
            sub="Valor manual en admin"
            tag="config"
            adminAnchor="saas-metrics-config"
            tooltip="Costo de adquisición promedio por cliente, cargado manualmente en admin. No se calcula automáticamente — para precisión real se necesita imputar gastos de marketing/ventas a cada alta."
          />
          <KpiCard
            label="LTV/CAC ratio"
            value={cac > 0 ? `${ltvCacRatio.toFixed(1)}×` : "—"}
            sub="LTV con margen / CAC"
            tag="estimated"
            tooltip="Ratio entre LTV con margen y CAC. Como ambos componentes son estimados, el ratio también lo es. Referencia healthy SaaS: > 3×."
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Payback (meses)"
            value={cac > 0 && paybackMonths > 0 ? `${paybackMonths.toFixed(1)}m` : "—"}
            sub="CAC / (ARPA · margen efectivo)"
            tag="estimated"
            tooltip="Meses necesarios para recuperar el CAC con el beneficio bruto mensual del cliente promedio. Estimado porque depende de CAC manual y margen efectivo (posiblemente default)."
          />
          <KpiCard
            label="Clientes en período"
            value={String(active.length)}
            sub={`${churned12} altas-bajas en 12m`}
            tag="real"
            tooltip="Cantidad de clientes activos según los filtros aplicados."
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="font-semibold mb-1 flex items-center gap-2">
              Distribución de margen bruto
              <DataTag tag="real" />
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Clientes activos por bucket — "Sin CMV" agrupa los que no tienen cmv_cost cargado.
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginBuckets}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {marginBuckets.map((b, i) => (
                      <Cell key={i} fill={
                        b.range === "Sin CMV" ? "hsl(var(--muted-foreground))" :
                        b.range === "<0%" ? "hsl(var(--destructive))" :
                        "hsl(var(--primary))"
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-semibold mb-1 flex items-center gap-2">
              LTV histórico vs margen
              <DataTag tag="real" />
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Solo clientes con CMV cargado. Tamaño = MRR USD actual.
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="x" name="Margen %" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <YAxis dataKey="y" name="LTV USD" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <ZAxis dataKey="z" range={[40, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                    formatter={(v: any, n: any) => n === "Margen %" ? `${Number(v).toFixed(1)}%` : fmtUsd(Number(v))}
                    labelFormatter={(_, p: any) => p?.[0]?.payload?.name ?? ""}
                  />
                  <Scatter data={scatterData} fill="hsl(var(--primary))" fillOpacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ClientRankTable title="Top 10 — Margen USD (real)" rows={topMargin} />
          <ClientRankTable title="Bottom 10 — Margen % (real)" rows={bottomMargin} />
        </div>

        {/* Full table */}
        <Card className="p-4">
          <div className="font-semibold mb-3">Detalle por cliente</div>
          <div className="overflow-x-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                  <TableHead className="text-right">MRR USD</TableHead>
                  <TableHead className="text-right">CMV USD</TableHead>
                  <TableHead className="text-right">Margen USD</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                  <TableHead className="text-right">LTV hist.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perClient.sort((a, b) => b.feeUsd - a.feeUsd).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{p.activeMonths}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(p.feeUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.hasCmv ? fmtUsd(p.cmvUsd) : <span className="text-muted-foreground italic">sin cargar</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.hasCmv ? fmtUsd(p.marginUsd) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${p.hasCmv && p.marginPct < 0 ? "text-destructive" : ""}`}>
                      {p.hasCmv ? fmtPct(p.marginPct) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(p.historicalLtvUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </PageContainer>
    </TooltipProvider>
  );
}

type Tag = "real" | "config" | "estimated";

function DataTag({ tag }: { tag: Tag }) {
  if (tag === "real") return <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-[9px] px-1.5 py-0">REAL</Badge>;
  if (tag === "config") return <Badge variant="outline" className="border-amber-500 text-amber-600 text-[9px] px-1.5 py-0">CONFIG</Badge>;
  return <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground text-[9px] px-1.5 py-0">ESTIMADO</Badge>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pt-2">
      <div className="font-semibold tracking-tight">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, tag, tooltip, adminAnchor,
}: {
  icon?: React.ReactNode; label: string; value: string; sub?: string;
  tag: Tag; tooltip: string; adminAnchor?: string;
}) {
  const isEstimated = tag === "estimated";
  const isConfig = tag === "config";
  return (
    <Card className={`p-4 ${isEstimated ? "opacity-90 border-dashed" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}<span className="leading-tight">{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DataTag tag={tag} />
          <UITooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </UITooltip>
        </div>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${isEstimated ? "text-muted-foreground" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      {isConfig && adminAnchor && (
        <Link to={`/admin#${adminAnchor}`} className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 hover:underline">
          <Settings className="h-3 w-3" /> Editar en admin
        </Link>
      )}
    </Card>
  );
}

function ClientRankTable({ title, rows }: { title: string; rows: any[] }) {
  return (
    <Card className="p-4">
      <div className="font-semibold mb-3 flex items-center gap-2">{title} <DataTag tag="real" /></div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">MRR</TableHead>
            <TableHead className="text-right">Margen</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">Sin clientes con CMV cargado</TableCell></TableRow>
          )}
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="max-w-[180px] truncate">{p.name}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtUsd(p.feeUsd)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtUsd(p.marginUsd)}</TableCell>
              <TableCell className={`text-right tabular-nums ${p.marginPct < 0 ? "text-destructive" : ""}`}>{fmtPct(p.marginPct)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
