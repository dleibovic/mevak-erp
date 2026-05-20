import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle } from "lucide-react";

const MAJOR_CURRENCIES = ["ARS", "EUR", "BRL", "MXN", "COP", "CLP", "PEN", "UYU"];

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function buildMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthStart(d));
  }
  return out;
}

export function ExchangeRatesAdmin() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [monthsCount, setMonthsCount] = useState(6);
  const months = useMemo(() => buildMonths(monthsCount), [monthsCount]);

  const { data: countries = [] } = useQuery({
    queryKey: ["currencies-from-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("fee_currency");
      const set = new Set<string>(MAJOR_CURRENCIES);
      (data ?? []).forEach((r: any) => r.fee_currency && r.fee_currency !== "USD" && set.add(r.fee_currency));
      return Array.from(set).sort();
    },
  });

  const { data: apiRates = [] } = useQuery({
    queryKey: ["exchange-rates-all"],
    queryFn: async () => {
      const { data } = await supabase.from("exchange_rates").select("*").order("rate_date", { ascending: false }).limit(2000);
      return data ?? [];
    },
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["exchange-rate-overrides"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("exchange_rate_overrides").select("*, updated_profile:profiles!exchange_rate_overrides_updated_by_fkey(full_name)");
      return data ?? [];
    },
  });

  const { data: ranges = [] } = useQuery({
    queryKey: ["exchange-rate-ranges"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("exchange_rate_validation_ranges").select("*");
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: { currency: string; month: string; rate: number; prefer: boolean }) => {
      const { error } = await (supabase as any).rpc("upsert_exchange_rate_override", {
        _currency: p.currency, _month: p.month, _rate: p.rate, _prefer_manual: p.prefer,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exchange-rate-overrides"] });
      qc.invalidateQueries({ queryKey: ["mrr-snapshots-pending"] });
      toast.success("Tipo de cambio guardado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("exchange_rate_overrides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exchange-rate-overrides"] });
      qc.invalidateQueries({ queryKey: ["mrr-snapshots-pending"] });
      toast.success("Override eliminado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const apiFor = (currency: string, month: string): number | null => {
    const monthEnd = new Date(month);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    const monthEndISO = monthEnd.toISOString().slice(0, 10);
    const found = (apiRates as any[])
      .filter((r) => r.base_currency === currency && r.quote_currency === "USD" && r.rate_date <= monthEndISO)
      .sort((a, b) => b.rate_date.localeCompare(a.rate_date))[0];
    return found ? Number(found.rate) : null;
  };
  const overrideFor = (currency: string, month: string) =>
    (overrides as any[]).find((o) => o.base_currency === currency && o.quote_currency === "USD" && o.period_month === month);
  const rangeFor = (currency: string) => (ranges as any[]).find((r) => r.currency === currency);

  return (
    <Card className="p-5 bg-gradient-card border-border/60 mt-4 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Tipos de cambio (→ USD)</h3>
          <p className="text-sm text-muted-foreground">
            Formato canónico: <strong>X unidades de moneda local por 1 USD</strong> (p.ej. ARS 1.400 = 1.400 ARS por dólar).
            Guardar un override marca el snapshot del mes como pendiente de recalcular.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Meses</label>
          <Input type="number" min={1} max={24} value={monthsCount} onChange={(e) => setMonthsCount(Number(e.target.value) || 6)} className="w-20" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Moneda</TableHead>
              <TableHead>Mes</TableHead>
              <TableHead>API</TableHead>
              <TableHead>Manual (local por USD)</TableHead>
              <TableHead>Usar manual</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead>Último cambio</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(countries as string[]).flatMap((currency) =>
              months.map((m) => (
                <Row key={`${currency}-${m}`}
                  currency={currency} month={m}
                  api={apiFor(currency, m)} override={overrideFor(currency, m)}
                  range={rangeFor(currency)}
                  onSave={upsert.mutate} onDelete={del.mutate}
                  disabled={!isAdmin} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function Row({ currency, month, api, override, range, onSave, onDelete, disabled }: any) {
  const [val, setVal] = useState<string>(override ? String(override.rate) : "");
  const [prefer, setPrefer] = useState<boolean>(override?.prefer_manual ?? true);
  const effective = override?.prefer_manual ? "manual" : "api";
  const numVal = Number(val);
  const valid = val !== "" && !Number.isNaN(numVal) && numVal > 0;
  const outOfRange = valid && range && (numVal < Number(range.min_rate) || numVal > Number(range.max_rate));

  const preview = valid
    ? `1.000 USD = ${currency} ${(1000 * numVal).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
    : "—";

  const handleSave = () => {
    if (!valid) return;
    if (outOfRange) {
      const ok = window.confirm(
        `El rate ingresado (${numVal}) está fuera del rango razonable para ${currency} ` +
        `(${range.min_rate}–${range.max_rate} por USD).\n\n` +
        `Preview: ${preview}\n\n¿Estás seguro de que querés guardarlo?`,
      );
      if (!ok) return;
    }
    onSave({ currency, month, rate: numVal, prefer });
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{currency}</TableCell>
      <TableCell className="text-xs">{month.slice(0, 7)}</TableCell>
      <TableCell className="text-xs">{api != null ? Number(api).toLocaleString("es-AR", { maximumFractionDigits: 4 }) : "—"}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Input type="number" step="0.0001" value={val} onChange={(e) => setVal(e.target.value)} className="w-32 h-8" disabled={disabled} placeholder="—" />
          <div className={`text-[11px] flex items-center gap-1 ${outOfRange ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {outOfRange && <AlertTriangle className="h-3 w-3" />}
            <span>{preview}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Switch checked={prefer} onCheckedChange={setPrefer} disabled={disabled} />
      </TableCell>
      <TableCell>
        <Badge variant={effective === "manual" ? "default" : "outline"} className="text-xs">{effective}</Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {override
          ? <>{override.updated_profile?.full_name ?? "—"}<br />{new Date(override.updated_at).toLocaleDateString()}</>
          : "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="outline" disabled={disabled || !valid} onClick={handleSave}>
            Guardar
          </Button>
          {override && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onDelete(override.id)}>Quitar</Button>}
        </div>
      </TableCell>
    </TableRow>
  );
}
