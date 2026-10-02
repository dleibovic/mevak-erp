import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from "recharts";

type Cur = "ARS" | "USD";
type Partner = "dario" | "maria";
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DARIO_CH = ["stripe_dario", "us_dario", "dario_transferencia", "dario_efectivo"];
const MARIA_CH = ["maria_transferencia", "maria_efectivo"];
const partnerOfChannel = (ch: string | null): Partner | null =>
  ch && DARIO_CH.includes(ch) ? "dario" : ch && MARIA_CH.includes(ch) ? "maria" : null;
const partnerLabel = (p: Partner | null) => (p === "dario" ? "Darío" : p === "maria" ? "Meri" : "Sin asignar");
const SUELDOS = ["sueldos", "sueldos extra"];
const bucketOf = (cat: string) => {
  const c = cat.trim().toLowerCase();
  if (SUELDOS.includes(c)) return "Sueldos";
  if (c === "comisiones") return "Comisiones a ejecutivos";
  return "Gastos";
};
const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 160 60% 45%))", "hsl(var(--chart-3, 30 80% 55%))"];

interface Inc { amount: number; currency: string; period_month: string; payment_channel: string | null; client_name: string; country_id: string | null; paid_at: string | null }
interface Exp { amount: number; currency: string; date: string; paid_by: string | null; description: string | null; category: string; country_id: string | null }

const ym = (d: string) => d.slice(0, 7);

export default function Estadisticas() {
  const { isAdmin, loading, roleLoading } = useAuth();
  if (loading || roleLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  return <EstadisticasInner />;
}

function EstadisticasInner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [usdArs, setUsdArs] = useState(1545);
  const [eurUsd, setEurUsd] = useState(1.165);
  const [cur, setCur] = useState<Cur>("ARS");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));

  const { countryId } = useCountryFilter();

  const { data: incomes = [] } = useQuery({
    queryKey: ["estadisticas-incomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("amount, amount_paid, currency, period_month, payment_channel, paid_at, status, clients(company_name, country_id)")
        .is("voided_at", null);
      if (error) throw error;
      // amount = lo efectivamente cobrado (incluye pagos a cuenta)
      return (data ?? []).map((r: any) => ({
        amount: Number(r.amount_paid) || 0, currency: r.currency ?? "ARS", period_month: r.period_month,
        payment_channel: r.payment_channel, client_name: r.clients?.company_name ?? "—",
        country_id: r.clients?.country_id ?? null, paid_at: r.paid_at ?? null,
      })).filter((i: Inc) => i.amount > 0) as Inc[];
    },
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["estadisticas-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, currency, date, paid_by, description, country_id, expense_categories(name)");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        amount: Number(r.amount) || 0, currency: r.currency ?? "ARS", date: r.date, paid_by: r.paid_by,
        description: r.description, category: r.expense_categories?.name ?? "Otros",
        country_id: r.country_id ?? null,
      })) as Exp[];
    },
  });
  const { data: unpaid = [] } = useQuery({
    queryKey: ["estadisticas-unpaid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("amount, amount_paid, currency, period_month, status, clients(company_name, country_id, assigned_executive_id)")
        .is("voided_at", null);
      if (error) throw error;
      // amount = saldo pendiente (amount - amount_paid)
      return (data ?? []).map((r: any) => ({
        amount: (Number(r.amount) || 0) - (Number(r.amount_paid) || 0), currency: r.currency ?? "ARS",
        period_month: r.period_month, country_id: r.clients?.country_id ?? null,
        status: r.status as string, client_name: (r.clients?.company_name ?? "—") as string,
        exec_id: (r.clients?.assigned_executive_id ?? null) as string | null,
      })).filter((u) => u.amount > 0);
    },
  });

  const { data: countryNames = {} } = useQuery({
    queryKey: ["estadisticas-countries"],
    queryFn: async () => {
      const { data } = await supabase.from("countries").select("id, name");
      return Object.fromEntries((data ?? []).map((c: any) => [c.id, c.name])) as Record<string, string>;
    },
  });
  const { data: execNames = {} } = useQuery({
    queryKey: ["estadisticas-execs"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name");
      return Object.fromEntries((data ?? []).map((e: any) => [e.id, e.full_name])) as Record<string, string>;
    },
  });
  const [detail, setDetail] = useState<null | "ingresos" | "egresos" | "deudaPeriodo" | "deudaAcum">(null);
  const { data: adjustments = [] } = useQuery({
    queryKey: ["cc-adjustments"],
    queryFn: async () => (await supabase.from("cc_adjustments").select("*").order("adjustment_date")).data ?? [],
  });
  const [adjDate, setAdjDate] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjFavor, setAdjFavor] = useState<Partner>("dario");
  const [adjConcepto, setAdjConcepto] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [ccFrom, setCcFrom] = useState("");   // vacío = desde el inicio
  const [ccTo, setCcTo] = useState(todayStr);
  const cName = (id: string | null) => (id ? countryNames[id] ?? "—" : "—");
  const perFmt = (d: string | null) => {
    if (!d) return "—";
    const [y, m] = d.slice(0, 7).split("-");
    return `${MONTHS[Number(m) - 1]?.slice(0, 3).toLowerCase()}-${y}`;
  };
  const dateFmt = (d: string | null) => (d ? new Date(d.length <= 10 ? d + "T00:00:00" : d).toLocaleDateString("es-AR") : "—");
  const orig = (a: number, c: string) => `${c} ${a.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  const payerLabel = (p: string | null) => (p === "dario" ? "Darío" : p === "maria" ? "Meri" : p ?? "—");
  const statusLabel: Record<string, string> = { pending: "Pendiente", invoiced: "Facturada", overdue: "Vencida" };

  const toUsd = (a: number, c: string) => (c === "USD" ? a : c === "EUR" ? a * eurUsd : a / (usdArs || 1));
  const conv = (a: number, c: string, target: Cur = cur) => {
    const usd = toUsd(a, c);
    return target === "USD" ? usd : usd * usdArs;
  };
  const other: Cur = cur === "ARS" ? "USD" : "ARS";
  const fmt = (v: number, c: Cur = cur) =>
    `${c === "USD" ? "US$" : "$"} ${v.toLocaleString("es-AR", { maximumFractionDigits: c === "USD" ? 2 : 0, minimumFractionDigits: 0 })}`;
  const fromCur = (v: number, target: Cur) => conv(v, cur, target); // convert a display-currency amount

  const years = useMemo(() => {
    const s = new Set<string>([String(now.getFullYear())]);
    incomes.forEach((i) => i.period_month && s.add(i.period_month.slice(0, 4)));
    expenses.forEach((e) => e.date && s.add(e.date.slice(0, 4)));
    return [...s].sort().reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes, expenses]);

  const inPeriod = (d: string, y: string, m: string) =>
    !!d && d.slice(0, 4) === y && (m === "all" || Number(d.slice(5, 7)) === Number(m));
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodLabel = (y: string, m: string) => (m === "all" ? `el año ${y}` : `${MONTHS[Number(m) - 1]} ${y}`);

  const compute = (inc: Inc[], exp: Exp[]) => {
    const ingresos = inc.reduce((s, i) => s + conv(i.amount, i.currency), 0);
    const buckets: Record<string, number> = { Sueldos: 0, "Comisiones a ejecutivos": 0, Gastos: 0 };
    const cats: Record<string, number> = {};
    exp.forEach((e) => {
      const v = conv(e.amount, e.currency);
      const b = bucketOf(e.category);
      buckets[b] += v;
      if (b === "Gastos") cats[e.category] = (cats[e.category] ?? 0) + v;
    });
    const egresos = buckets.Sueldos + buckets["Comisiones a ejecutivos"] + buckets.Gastos;
    return { ingresos, egresos, neta: ingresos - egresos, buckets, cats };
  };

  const matchCountry = (id: string | null) => !countryId || id === countryId;
  const fInc = incomes.filter((i) => inPeriod(i.period_month, year, month) && matchCountry(i.country_id));
  const fExp = expenses.filter((e) => inPeriod(e.date, year, month) && matchCountry(e.country_id));
  const inCcRange = (d: string | null) => !!d && (!ccFrom || d >= ccFrom) && (!ccTo || d <= ccTo);
  const ccInc = incomes.filter((i) => matchCountry(i.country_id) && inCcRange(i.period_month));
  const ccExp = expenses.filter((e) => matchCountry(e.country_id) && inCcRange(e.date));
  const sum = compute(fInc, fExp);
  const mInc = incomes.filter((i) => ym(i.period_month ?? "") === curYm && matchCountry(i.country_id));
  const mExp = expenses.filter((e) => ym(e.date ?? "") === curYm && matchCountry(e.country_id));
  const mSum = compute(mInc, mExp);

  const deudaPeriodo = unpaid
    .filter((u: any) => inPeriod(u.period_month, year, month) && matchCountry(u.country_id))
    .reduce((s: number, u: any) => s + conv(u.amount, u.currency), 0);
  const deudaAcum = unpaid
    .filter((u: any) => matchCountry(u.country_id))
    .reduce((s: number, u: any) => s + conv(u.amount, u.currency), 0);

  // Cuenta corriente
  const cc = useMemo(() => {
    const r = { dario: { cobro: 0, aporto: 0 }, maria: { cobro: 0, aporto: 0 }, sinAsignar: 0 };
    ccInc.forEach((i) => {
      const p = partnerOfChannel(i.payment_channel);
      const v = conv(i.amount, i.currency);
      if (p) r[p].cobro += v; else r.sinAsignar += v;
    });
    ccExp.forEach((e) => {
      if (e.paid_by === "dario" || e.paid_by === "maria") r[e.paid_by].aporto += conv(e.amount, e.currency);
    });
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccInc, ccExp, cur, usdArs, eurUsd, countryId, ccFrom, ccTo]);
  const posD = cc.dario.aporto - cc.dario.cobro;
  const posM = cc.maria.aporto - cc.maria.cobro;
  const saldoD = (posD - posM) / 2;

  // Saldo inicial y ajustes de cuenta corriente (acumulados hasta la fecha "Hasta" de la CC)
  const adjSigned = (a: any) => (a.in_favor_of === "dario" ? 1 : -1) * conv(Number(a.amount), "ARS");
  const ajustesAplicables = (adjustments as any[]).filter((a) => !ccTo || a.adjustment_date <= ccTo);
  const ajusteTotal = ajustesAplicables.reduce((s, a) => s + adjSigned(a), 0);
  const saldoTotal = saldoD + ajusteTotal;

  const addAdjustment = async () => {
    if (!adjDate || !adjConcepto.trim() || !(Number(adjAmount) > 0)) {
      toast.error("Completá fecha, monto mayor a 0 y concepto.");
      return;
    }
    setAdjSaving(true);
    const { error } = await supabase.from("cc_adjustments").insert({
      adjustment_date: adjDate,
      amount: Number(adjAmount),
      in_favor_of: adjFavor,
      concepto: adjConcepto.trim(),
      created_by: user?.id,
    });
    setAdjSaving(false);
    if (error) { toast.error("No se pudo guardar el ajuste."); return; }
    toast.success("Ajuste agregado.");
    setAdjDate(""); setAdjAmount(""); setAdjConcepto(""); setAdjFavor("dario");
    queryClient.invalidateQueries({ queryKey: ["cc-adjustments"] });
  };

  const deleteAdjustment = async (id: string) => {
    const { error } = await supabase.from("cc_adjustments").delete().eq("id", id);
    if (error) { toast.error("No se pudo borrar el ajuste."); return; }
    toast.success("Ajuste borrado.");
    queryClient.invalidateQueries({ queryKey: ["cc-adjustments"] });
  };

  // Proyección: últimos 3 meses completos
  const last3 = useMemo(() => {
    const keys: string[] = [];
    for (let k = 1; k <= 3; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return keys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const baseIngUsd = incomes.filter((i) => last3.includes(ym(i.period_month ?? "")) && matchCountry(i.country_id)).reduce((s, i) => s + toUsd(i.amount, i.currency), 0) / 3;
  const baseEgrUsd = expenses.filter((e) => last3.includes(ym(e.date ?? "")) && matchCountry(e.country_id)).reduce((s, e) => s + toUsd(e.amount, e.currency), 0) / 3;
  const [ingOverride, setIngOverride] = useState<number | null>(null);
  const [egrOverride, setEgrOverride] = useState<number | null>(null);
  const [horizon, setHorizon] = useState(3);
  const ingBase = ingOverride ?? Math.round(conv(baseIngUsd, "USD"));
  const egrBase = egrOverride ?? Math.round(conv(baseEgrUsd, "USD"));
  const projRows = Array.from({ length: horizon }, (_, k) => {
    const n = k + 1;
    const d = new Date(now.getFullYear(), now.getMonth() + n, 1);
    return {
      n, label: `${MONTHS[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
      ing: ingBase * n, egr: egrBase * n, gan: (ingBase - egrBase) * n, socio: ((ingBase - egrBase) * n) / 2,
    };
  });
  const changeCur = (c: Cur) => { setCur(c); setIngOverride(null); setEgrOverride(null); };

  const Kpi = ({ title, value, tone, onClick }: { title: string; value: number; tone?: "pos" | "neg"; onClick?: () => void }) => (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={onClick ? "cursor-pointer transition-colors hover:border-primary/50 hover:bg-secondary/40" : undefined}
    >
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {onClick && <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Ver detalle" />}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone === "neg" ? "text-destructive" : ""}`}>{fmt(value)}</div>
        <div className="text-xs text-muted-foreground">≈ {fmt(fromCur(value, other), other)}</div>
      </CardContent>
    </Card>
  );

  const KpiGrid = ({ s, clickable }: { s: ReturnType<typeof compute>; clickable?: boolean }) => (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Kpi title="Ingresos (cobrado)" value={s.ingresos} onClick={clickable ? () => setDetail("ingresos") : undefined} />
      <Kpi title="Egresos total" value={s.egresos} onClick={clickable ? () => setDetail("egresos") : undefined} />
      <Kpi title="Ganancia neta" value={s.neta} tone={s.neta < 0 ? "neg" : "pos"} />
      <Kpi title="Ganancia por socio" value={s.neta / 2} tone={s.neta < 0 ? "neg" : "pos"} />
    </div>
  );

  const Buckets = ({ s }: { s: ReturnType<typeof compute> }) => {
    const [open, setOpen] = useState(false);
    const cats = Object.entries(s.cats).sort((a, b) => b[1] - a[1]);
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Desglose de egresos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(["Sueldos", "Comisiones a ejecutivos"] as const).map((b) => (
            <div key={b} className="flex justify-between border-b pb-2"><span>{b}</span><span className="font-medium">{fmt(s.buckets[b])}</span></div>
          ))}
          <button className="flex w-full justify-between border-b pb-2 text-left" onClick={() => setOpen(!open)}>
            <span className="flex items-center gap-1">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Gastos</span>
            <span className="font-medium">{fmt(s.buckets.Gastos)}</span>
          </button>
          {open && (
            <div className="pl-6 space-y-1 text-sm">
              {cats.length === 0 && <div className="text-muted-foreground">Sin gastos</div>}
              {cats.map(([c, v]) => (
                <div key={c} className="flex justify-between text-muted-foreground"><span>{c}</span><span>{fmt(v)}</span></div>
              ))}
            </div>
          )}
          <div className="flex justify-between pt-1 font-semibold"><span>Total</span><span>{fmt(s.egresos)}</span></div>
        </CardContent>
      </Card>
    );
  };

  const tooltipFmt = (v: number) => fmt(Number(v));
  const pieData = (s: ReturnType<typeof compute>) =>
    Object.entries(s.buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">Situación financiera, cuenta entre socios y proyección.</p>
      </div>

      <Card>
        <CardContent className="pt-6 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-end">
          <div className="space-y-1">
            <Label>Año</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Mes</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => { setYear(String(now.getFullYear())); setMonth(String(now.getMonth() + 1)); }}>Mes actual</Button>
          <div className="space-y-1">
            <Label>USD → ARS</Label>
            <Input type="number" value={usdArs} onChange={(e) => setUsdArs(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label>EUR → USD</Label>
            <Input type="number" step="0.001" value={eurUsd} onChange={(e) => setEurUsd(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label>Mostrar en</Label>
            <div className="flex gap-1">
              {(["ARS", "USD"] as Cur[]).map((c) => (
                <Button key={c} className="flex-1" variant={cur === c ? "default" : "outline"} onClick={() => changeCur(c)}>{c}</Button>
              ))}
            </div>
          </div>
          <div className="col-span-full text-xs text-muted-foreground">
            TC usado: 1 USD = $ {usdArs.toLocaleString("es-AR")} · 1 EUR = US$ {eurUsd} (= $ {(eurUsd * usdArs).toLocaleString("es-AR", { maximumFractionDigits: 0 })})
            <br />
            Respeta el selector &laquo;Vista por país&raquo; del encabezado.
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumen">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="mes">Mes actual</TabsTrigger>
          <TabsTrigger value="cc">Cuenta corriente socios</TabsTrigger>
          <TabsTrigger value="proy">Proyección</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <KpiGrid s={sum} clickable />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Kpi title="Deuda del período (a cobrar)" value={deudaPeriodo} onClick={() => setDetail("deudaPeriodo")} />
            <Kpi title="Deuda acumulada (a cobrar)" value={deudaAcum} onClick={() => setDetail("deudaAcum")} />
          </div>
          <Card>
            <CardContent className="pt-6 text-sm">
              En <b>{periodLabel(year, month)}</b> cobraste <b>{fmt(sum.ingresos)}</b>, gastaste <b>{fmt(sum.egresos)}</b>, ganancia neta{" "}
              <b>{fmt(sum.neta)}</b>; a cada socio le corresponden <b>{fmt(sum.neta / 2)}</b>.
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Buckets s={sum} />
            <Card>
              <CardHeader><CardTitle className="text-base">Egresos por bucket</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData(sum)} dataKey="value" nameKey="name" outerRadius={80} label={false}>
                      {pieData(sum).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={tooltipFmt} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Ingresos vs Egresos</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer>
                  <BarChart data={[{ name: "Período", Ingresos: sum.ingresos, Egresos: sum.egresos }]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => Number(v).toLocaleString("es-AR", { notation: "compact" })} />
                    <Tooltip formatter={tooltipFmt} />
                    <Legend />
                    <Bar dataKey="Ingresos" fill={COLORS[1]} />
                    <Bar dataKey="Egresos" fill="hsl(var(--destructive))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mes" className="space-y-4">
          <p className="text-sm text-muted-foreground">{MONTHS[now.getMonth()]} {now.getFullYear()}</p>
          <KpiGrid s={mSum} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Buckets s={mSum} />
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Ingresos del mes</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Cobró</TableHead><TableHead className="text-right">ARS</TableHead><TableHead className="text-right">USD</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {mInc.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sin cobros registrados</TableCell></TableRow>}
                    {mInc.map((i, k) => (
                      <TableRow key={k}>
                        <TableCell>{i.client_name}</TableCell>
                        <TableCell><Badge variant="outline">{partnerLabel(partnerOfChannel(i.payment_channel))}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(conv(i.amount, i.currency, "ARS"), "ARS")}</TableCell>
                        <TableCell className="text-right">{fmt(conv(i.amount, i.currency, "USD"), "USD")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Egresos del mes</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Categoría</TableHead><TableHead>Pagó</TableHead><TableHead className="text-right">ARS</TableHead><TableHead className="text-right">USD</TableHead></TableRow></TableHeader>
                <TableBody>
                  {mExp.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sin egresos registrados</TableCell></TableRow>}
                  {mExp.map((e, k) => (
                    <TableRow key={k}>
                      <TableCell>{e.description || "—"}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell><Badge variant="outline">{partnerLabel(e.paid_by === "dario" || e.paid_by === "maria" ? e.paid_by : null)}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(conv(e.amount, e.currency, "ARS"), "ARS")}</TableCell>
                      <TableCell className="text-right">{fmt(conv(e.amount, e.currency, "USD"), "USD")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cc" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={ccFrom} onChange={(e) => setCcFrom(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setCcFrom("")}>Desde el inicio</Button>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={ccTo} onChange={(e) => setCcTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setCcTo(todayStr)}>Hoy</Button>
            <p className="text-xs text-muted-foreground max-w-md">
              Acumulado entre las fechas elegidas. "Desde el inicio" = toda la historia cargada. El saldo total incluye el saldo inicial y los ajustes hasta la fecha "Hasta".
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Cuenta corriente · {ccFrom || "inicio"} → {ccTo || "hoy"}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead /><TableHead className="text-right">Darío</TableHead><TableHead className="text-right">Meri</TableHead></TableRow></TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Cobró</TableCell><TableCell className="text-right">{fmt(cc.dario.cobro)}</TableCell><TableCell className="text-right">{fmt(cc.maria.cobro)}</TableCell></TableRow>
                    <TableRow><TableCell>Aportó</TableCell><TableCell className="text-right">{fmt(cc.dario.aporto)}</TableCell><TableCell className="text-right">{fmt(cc.maria.aporto)}</TableCell></TableRow>
                    <TableRow className="font-semibold"><TableCell>Posición neta (Aportó − Cobró)</TableCell><TableCell className="text-right">{fmt(posD)}</TableCell><TableCell className="text-right">{fmt(posM)}</TableCell></TableRow>
                  </TableBody>
                </Table>
                <div className="mt-4 rounded-md border p-4 space-y-1">
                  <div className="text-sm text-muted-foreground">Saldo acumulado a favor de Darío = (PosiciónDarío − PosiciónMeri) / 2</div>
                  <div className="text-2xl font-bold">{fmt(saldoD)}</div>
                  <div className="text-xs text-muted-foreground">≈ {fmt(fromCur(saldoD, other), other)}</div>
                  <p className="text-sm">
                    {Math.abs(saldoD) < 0.5 ? "Están a mano en este acumulado."
                      : saldoD > 0 ? `Positivo: Meri le debe ${fmt(saldoD)} a Darío.`
                      : `Negativo: Darío le debe ${fmt(-saldoD)} a Meri.`}
                  </p>
                  {cc.sinAsignar > 0 && (
                    <p className="text-xs text-muted-foreground">Hay {fmt(cc.sinAsignar)} cobrados sin canal de pago asignado (no se atribuyen a ningún socio).</p>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium">Saldo inicial y ajustes (hasta {ccTo || "hoy"})</div>
                  {ajustesAplicables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin ajustes.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead>A favor de</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ajustesAplicables.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell>{dateFmt(a.adjustment_date)}</TableCell>
                            <TableCell>{a.concepto}</TableCell>
                            <TableCell><Badge variant="outline">{a.in_favor_of === "dario" ? "Darío" : "Meri"}</Badge></TableCell>
                            <TableCell className={`text-right ${adjSigned(a) >= 0 ? "text-primary" : "text-accent"}`}>{fmt(adjSigned(a))}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold">
                          <TableCell colSpan={3}>Subtotal de ajustes</TableCell>
                          <TableCell className="text-right">{fmt(ajusteTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="mt-4 rounded-md border border-primary/40 bg-secondary/50 p-4 space-y-1">
                  <div className="text-sm text-muted-foreground">SALDO TOTAL a favor de Darío = movimiento acumulado + ajustes</div>
                  <div className="text-2xl font-bold">{fmt(saldoTotal)}</div>
                  <div className="text-xs text-muted-foreground">≈ {fmt(fromCur(saldoTotal, other), other)}</div>
                  <p className="text-sm">Positivo = Meri le debe a Darío; negativo = al revés.</p>
                  <p className="text-xs text-muted-foreground">Incluye el saldo inicial (provisorio, a validar con Meri). El movimiento es transaccional dentro del rango elegido; los ajustes se acumulan hasta la fecha "Hasta".</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Aportó vs Cobró</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={[
                    { name: "Darío", Aportó: cc.dario.aporto, Cobró: cc.dario.cobro },
                    { name: "Meri", Aportó: cc.maria.aporto, Cobró: cc.maria.cobro },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => Number(v).toLocaleString("es-AR", { notation: "compact" })} />
                    <Tooltip formatter={tooltipFmt} />
                    <Legend />
                    <Bar dataKey="Aportó" fill={COLORS[2]} />
                    <Bar dataKey="Cobró" fill={COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ajustes de cuenta corriente</CardTitle>
              <CardDescription>Los montos van en ARS. "A favor de Darío" suma al saldo de Darío; "a favor de Meri" lo resta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(adjustments as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay ajustes cargados.</p>
              ) : (
                <div className="max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>A favor de</TableHead>
                        <TableHead className="text-right">Monto (ARS)</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(adjustments as any[]).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{dateFmt(a.adjustment_date)}</TableCell>
                          <TableCell>{a.concepto}</TableCell>
                          <TableCell><Badge variant="outline">{a.in_favor_of === "dario" ? "Darío" : "Meri"}</Badge></TableCell>
                          <TableCell className="text-right">{fmt(Number(a.amount), "ARS")}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => deleteAdjustment(a.id)} aria-label="Borrar ajuste">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
                <div className="space-y-1">
                  <Label htmlFor="adj-fecha">Fecha</Label>
                  <Input id="adj-fecha" type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adj-monto">Monto (ARS)</Label>
                  <Input id="adj-monto" type="number" min="0" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>A favor de</Label>
                  <Select value={adjFavor} onValueChange={(v) => setAdjFavor(v as Partner)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dario">Darío</SelectItem>
                      <SelectItem value="maria">Meri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adj-concepto">Concepto</Label>
                  <Input id="adj-concepto" value={adjConcepto} onChange={(e) => setAdjConcepto(e.target.value)} placeholder="Ej: Saldo inicial" />
                </div>
                <Button onClick={addAdjustment} disabled={adjSaving}>Agregar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proy" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid gap-4 md:grid-cols-3 items-end">
              <div className="space-y-1">
                <Label>Horizonte</Label>
                <div className="flex gap-1">
                  {[1, 3, 6, 12].map((h) => (
                    <Button key={h} className="flex-1" variant={horizon === h ? "default" : "outline"} onClick={() => setHorizon(h)}>{h}m</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Ingresos/mes base ({cur})</Label>
                <Input type="number" value={ingBase} onChange={(e) => setIngOverride(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label>Egresos/mes base ({cur})</Label>
                <Input type="number" value={egrBase} onChange={(e) => setEgrOverride(Number(e.target.value) || 0)} />
              </div>
              <div className="col-span-full flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Proyección lineal con foto actual (promedio últimos 3 meses). No contempla altas/bajas futuras ni estacionalidad; ajustá las bases para simular escenarios.
                {(ingOverride !== null || egrOverride !== null) && (
                  <Button size="sm" variant="ghost" onClick={() => { setIngOverride(null); setEgrOverride(null); }}>Restablecer bases</Button>
                )}
              </div>
            </CardContent>
          </Card>
          {projRows.length > 0 && (() => {
            const last = projRows[projRows.length - 1];
            const s = { ingresos: last.ing, egresos: last.egr, neta: last.gan, buckets: {}, cats: {} } as any;
            return <KpiGrid s={s} />;
          })()}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Ganancia acumulada</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={projRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => Number(v).toLocaleString("es-AR", { notation: "compact" })} />
                    <Tooltip formatter={tooltipFmt} />
                    <Legend />
                    <Area type="monotone" dataKey="gan" name="Ganancia neta" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} />
                    <Area type="monotone" dataKey="socio" name="Por socio" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Detalle mensual (acumulado)</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Mes</TableHead><TableHead className="text-right">Ingresos</TableHead><TableHead className="text-right">Egresos</TableHead><TableHead className="text-right">Ganancia</TableHead><TableHead className="text-right">Por socio</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {projRows.map((r) => (
                      <TableRow key={r.n}>
                        <TableCell>{r.n} · {r.label}</TableCell>
                        <TableCell className="text-right">{fmt(r.ing)}</TableCell>
                        <TableCell className="text-right">{fmt(r.egr)}</TableCell>
                        <TableCell className="text-right">{fmt(r.gan)}</TableCell>
                        <TableCell className="text-right">{fmt(r.socio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {detail === "ingresos" ? `Ingresos cobrados · ${periodLabel(year, month)}`
                : detail === "egresos" ? `Egresos · ${periodLabel(year, month)}`
                : detail === "deudaPeriodo" ? `Deuda del período · ${periodLabel(year, month)}`
                : "Deuda acumulada (todas las impagas)"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto">
            {detail === "ingresos" && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>País</TableHead><TableHead>Período</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead><TableHead>Quién cobró</TableHead><TableHead>Fecha de cobro</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fInc.map((i, k) => (
                    <TableRow key={k}>
                      <TableCell>{i.client_name}</TableCell><TableCell>{cName(i.country_id)}</TableCell>
                      <TableCell>{perFmt(i.period_month)}</TableCell><TableCell className="text-right whitespace-nowrap">{orig(i.amount, i.currency)}</TableCell>
                      <TableCell><Badge variant="outline">{partnerLabel(partnerOfChannel(i.payment_channel))}</Badge></TableCell>
                      <TableCell>{dateFmt(i.paid_at)}</TableCell>
                    </TableRow>
                  ))}
                  {fInc.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
            {detail === "egresos" && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Concepto</TableHead><TableHead>Categoría</TableHead><TableHead className="text-right">Monto</TableHead>
                  <TableHead>Quién pagó</TableHead><TableHead>Fecha</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fExp.map((e, k) => (
                    <TableRow key={k}>
                      <TableCell>{e.description ?? "—"}</TableCell><TableCell>{e.category}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{orig(e.amount, e.currency)}</TableCell>
                      <TableCell>{payerLabel(e.paid_by)}</TableCell><TableCell>{dateFmt(e.date)}</TableCell>
                    </TableRow>
                  ))}
                  {fExp.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
            {(detail === "deudaPeriodo" || detail === "deudaAcum") && (() => {
              const rows = unpaid.filter((u) => matchCountry(u.country_id) && (detail === "deudaAcum" || inPeriod(u.period_month, year, month)));
              return (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Cliente</TableHead><TableHead>País</TableHead><TableHead>Período</TableHead>
                    <TableHead className="text-right">Saldo</TableHead><TableHead>Estado</TableHead><TableHead>Responsable</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map((u, k) => (
                      <TableRow key={k}>
                        <TableCell>{u.client_name}</TableCell><TableCell>{cName(u.country_id)}</TableCell>
                        <TableCell>{perFmt(u.period_month)}</TableCell><TableCell className="text-right whitespace-nowrap">{orig(u.amount, u.currency)}</TableCell>
                        <TableCell><Badge variant={u.status === "overdue" ? "destructive" : "outline"}>{statusLabel[u.status] ?? u.status}</Badge></TableCell>
                        <TableCell>{u.exec_id ? execNames[u.exec_id] ?? "—" : "—"}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
          <div className="flex justify-between border-t pt-3 font-semibold">
            <span>Total ({cur})</span>
            <span>{fmt(detail === "ingresos" ? sum.ingresos : detail === "egresos" ? sum.egresos : detail === "deudaPeriodo" ? deudaPeriodo : deudaAcum)}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
