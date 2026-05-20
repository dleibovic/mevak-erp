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

  const displayCurrency = getDisplayCurrency(country, countries as any);
  const displayCountryName = getDisplayCountryName(country, countries as any);
  const fmtMoney = (usd: number) => fmtDisplay(usd, displayCurrency, latestRate);

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

  // ---- Real gross margin per client: fee - commission - (exec_salary / active_clients_for_exec) ----
  const employeeById = useMemo(() => {
    const m = new Map<string, any>();
    (employees as any[]).forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  // Active client count by assigned executive (uses ALL clients, unaffected by filters)
  const activeCountByExec = useMemo(() => {
    const m = new Map<string, number>();
    clients.forEach((c) => {
      if (c.status !== "active" || !c.assigned_executive_id) return;
      m.set(c.assigned_executive_id, (m.get(c.assigned_executive_id) ?? 0) + 1);
    });
    return m;
  }, [clients]);

  // Sum of commissions per client (across all assigned execs) in USD
  const commissionUsdByClient = useMemo(() => {
    const m = new Map<string, number>();
    (commissionRows as any[]).forEach((r) => {
      const usd = toUsd(Number(r.commission_value || 0), r.currency || "USD");
      m.set(r.client_id, (m.get(r.client_id) ?? 0) + usd);
    });
    return m;
  }, [commissionRows, latestRate]);

  const today = new Date();
  const perClient = useMemo(() => {
    return filteredClients.map((c) => {
      const effectiveFee = c.discount_active && c.discount_percentage
        ? c.monthly_fee * (1 - Number(c.discount_percentage) / 100)
        : c.monthly_fee;
      const feeUsd = toUsd(Number(effectiveFee || 0), c.fee_currency);
      const cmvUsd = toUsd(Number(c.cmv_cost || 0), c.cmv_currency);
      const hasCmv = Number(c.cmv_cost || 0) > 0;

      // New margin formula
      const commissionUsd = commissionUsdByClient.get(c.id) ?? 0;
      const exec = c.assigned_executive_id ? employeeById.get(c.assigned_executive_id) : null;
      const execSalaryUsd = exec && Number(exec.base_salary || 0) > 0
        ? toUsd(Number(exec.base_salary), exec.salary_currency || "USD")
        : 0;
      const execActiveCount = c.assigned_executive_id
        ? (activeCountByExec.get(c.assigned_executive_id) ?? 0)
        : 0;
      const allocatedSalaryUsd = exec && execSalaryUsd > 0 && execActiveCount > 0
        ? execSalaryUsd / execActiveCount
        : 0;

      const missingExec = !exec;
      const missingSalary = !!exec && !(Number(exec.base_salary || 0) > 0);
      const incomplete = missingExec || missingSalary;

      let marginUsd: number;
      let marginPct: number;
      if (incomplete) {
        // Fallback: usar margen default sobre el fee
        marginUsd = feeUsd * grossMarginDefault;
        marginPct = grossMarginDefault;
      } else {
        marginUsd = feeUsd - commissionUsd - allocatedSalaryUsd;
        marginPct = feeUsd > 0 ? marginUsd / feeUsd : 0;
      }

      const start = c.activated_at ? new Date(c.activated_at) : null;
      const end = c.churned_at ? new Date(c.churned_at) : today;
      const activeMonths = start
        ? Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1)
        : 0;

      const rows = cmhByClient.get(c.id) ?? [];
      const historicalLtvUsd = rows.reduce((s, r) => r.movement_type === "churn" ? s : s + Number(r.mrr_amount_usd || 0), 0);

      return {
        id: c.id, name: c.company_name, status: c.status, activeMonths,
        feeUsd, cmvUsd, hasCmv,
        commissionUsd, allocatedSalaryUsd, execName: exec?.full_name ?? null,
        incomplete, missingExec, missingSalary,
        marginPct, marginUsd, historicalLtvUsd,
      };
    });
  }, [filteredClients, cmhByClient, latestRate, commissionUsdByClient, employeeById, activeCountByExec, grossMarginDefault]);

  const active = perClient.filter((p) => p.status === "active");
  const totalMrrUsd = active.reduce((s, p) => s + p.feeUsd, 0);

  // Aggregate real margin (using formula for complete clients, fallback for incomplete)
  const totalMarginUsd = active.reduce((s, p) => s + p.marginUsd, 0);
  const aggregateMarginPct = totalMrrUsd > 0 ? totalMarginUsd / totalMrrUsd : 0;
  const incompleteCount = active.filter((p) => p.incomplete).length;
  const completeCoverage = active.length > 0 ? (active.length - incompleteCount) / active.length : 0;

  // CMV-based margin (informational only, kept for reference)
  const withCmv = active.filter((p) => p.hasCmv);
  const cmvCoverage = totalMrrUsd > 0 ? withCmv.reduce((s, p) => s + p.feeUsd, 0) / totalMrrUsd : 0;

  // Effective margin for LTV = aggregate real margin (already mixes fallback per cliente)
  const effectiveMarginPct = aggregateMarginPct;

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
      { range: "<0%", min: -Infinity, max: 0, count: 0 },
      { range: "0-25%", min: 0, max: 0.25, count: 0 },
      { range: "25-50%", min: 0.25, max: 0.5, count: 0 },
      { range: "50-75%", min: 0.5, max: 0.75, count: 0 },
      { range: "75-100%", min: 0.75, max: 1.01, count: 0 },
    ];
    active.forEach((p) => {
      const b = buckets.find((x) => p.marginPct >= x.min && p.marginPct < x.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [active]);

  const scatterData = active.map((p) => ({
    x: p.marginPct * 100, y: p.historicalLtvUsd, z: p.feeUsd, name: p.name,
  }));

  const topMargin = [...active].sort((a, b) => b.marginUsd - a.marginUsd).slice(0, 10);
  const bottomMargin = [...active].filter((p) => p.feeUsd > 0).sort((a, b) => a.marginPct - b.marginPct).slice(0, 10);

  return (
    <TooltipProvider delayDuration={200}>
      <PageContainer>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <PageHeader
            title="LTV & Rentabilidad"
            description="Cada KPI marcado como estimado depende de parámetros configurables o de tracking que aún no está implementado."
          />
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Mostrando en</span>
            <span className="font-semibold tabular-nums">{displayCurrency}</span>
            {displayCountryName && <span className="text-muted-foreground">· {displayCountryName}</span>}
          </div>
        </div>

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
            label={`MRR activo (${displayCurrency})`}
            value={fmtMoney(totalMrrUsd)}
            sub={`${active.length} clientes activos`}
            tag="real"
            tooltip={`Suma de monthly_fee efectivo (con descuento activo) de clientes con status='active'. Convertido a ${displayCurrency} al rate canónico más reciente.`}
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label={`ARPA (${displayCurrency})`}
            value={fmtMoney(arpa)}
            sub="MRR / clientes activos"
            tag="real"
            tooltip="MRR activo / cantidad de clientes activos. No incluye clientes pausados ni churned."
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
            label={`LTV simple (${displayCurrency})`}
            value={fmtMoney(ltvSimple)}
            sub="(ARPA · 12) / churn anual"
            tag="real"
            tooltip="Fórmula clásica: ingreso anual promedio dividido la tasa de churn anual. No incluye margen — bruto sobre el revenue, no sobre el beneficio."
          />

        </div>

        {/* Section 2: Rentabilidad (REAL formula) */}
        <SectionTitle
          title="Rentabilidad"
          subtitle={
            incompleteCount === 0
              ? `Margen calculado con datos reales sobre los ${active.length} clientes activos.`
              : `Margen real sobre ${active.length - incompleteCount} clientes (${fmtPct(completeCoverage, 0)}). ${incompleteCount} clientes sin ejecutivo o sin sueldo cargado usan el margen default como fallback.`
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margen bruto agregado"
            value={fmtPct(aggregateMarginPct)}
            sub={`Σ margen / Σ MRR · ${active.length} clientes`}
            tag={incompleteCount === 0 ? "real" : "config"}
            tooltip={`Fórmula por cliente: fee − comisión_ejecutivo − (sueldo_ejecutivo / clientes_activos_del_ejecutivo). Todos los componentes se convierten a USD al rate más reciente antes de sumar. Agregado = Σ margen_USD / Σ fee_USD sobre todos los activos. ${incompleteCount > 0 ? `Para ${incompleteCount} clientes sin ejecutivo asignado o sin sueldo cargado se usa el margen default (${fmtPct(grossMarginDefault, 0)}).` : ""}`}
          />
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margen efectivo (LTV)"
            value={fmtPct(effectiveMarginPct)}
            sub={incompleteCount === 0 ? "= margen real" : `incluye fallback para ${incompleteCount} clientes`}
            tag={incompleteCount === 0 ? "real" : "config"}
            tooltip="Margen efectivo usado para calcular LTV con margen. Coincide con el margen agregado: ya combina cálculo real y fallback por cliente según completitud de datos."
          />
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margen default (fallback)"
            value={fmtPct(grossMarginDefault, 0)}
            sub="Solo para clientes sin ejecutivo / sin sueldo"
            tag="config"
            adminAnchor="saas-metrics-config"
            tooltip="Margen bruto estimado usado como fallback únicamente cuando un cliente no tiene ejecutivo asignado o el ejecutivo no tiene base_salary cargado. Editable en /admin → Parámetros de métricas SaaS → gross_margin_default_pct."
          />
          <KpiCard
            label="LTV con margen"
            value={fmtMoney(ltvMargin)}
            sub="LTV simple · margen efectivo"
            tag={incompleteCount === 0 ? "real" : "config"}
            tooltip="LTV simple multiplicado por el margen efectivo (real con fallback parcial)."
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
