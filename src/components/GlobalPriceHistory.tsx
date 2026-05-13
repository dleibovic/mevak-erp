import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { formatMoney, fmtDate } from "@/lib/format";
import { PRICE_CHANGE_LABEL } from "@/lib/billing";

export function GlobalPriceHistory() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["client_price_history_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_price_history")
        .select("*, client:clients(id, company_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (rows as any[]).filter((r) => {
      if (type !== "all" && r.change_type !== type) return false;
      if (search && !(r.client?.company_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, search, type]);

  const metrics = useMemo(() => {
    const m = { total: filtered.length, increases: 0, decreases: 0, discounts: 0, expired: 0 };
    filtered.forEach((r: any) => {
      if (r.change_type === "increase") m.increases++;
      else if (r.change_type === "decrease") m.decreases++;
      else if (r.change_type === "discount_applied") m.discounts++;
      else if (r.change_type === "discount_expired") m.expired++;
    });
    return m;
  }, [filtered]);

  function exportCSV() {
    const header = ["Fecha", "Cliente", "Tipo", "Anterior", "Nuevo", "Moneda", "% cambio", "Vence"];
    const lines = filtered.map((r: any) => [
      fmtDate(r.created_at), r.client?.company_name ?? "", PRICE_CHANGE_LABEL[r.change_type] ?? r.change_type,
      r.previous_amount ?? "", r.new_amount ?? "", r.currency ?? "", r.percentage_change ?? "", r.discount_ends_at ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `historial_precios.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3 bg-gradient-card border-border/60"><div className="text-xs text-muted-foreground">Cambios</div><div className="text-xl font-semibold">{metrics.total}</div></Card>
        <Card className="p-3 bg-gradient-card border-border/60"><div className="text-xs text-muted-foreground">Aumentos</div><div className="text-xl font-semibold text-success">{metrics.increases}</div></Card>
        <Card className="p-3 bg-gradient-card border-border/60"><div className="text-xs text-muted-foreground">Disminuciones</div><div className="text-xl font-semibold text-destructive">{metrics.decreases}</div></Card>
        <Card className="p-3 bg-gradient-card border-border/60"><div className="text-xs text-muted-foreground">Descuentos aplicados</div><div className="text-xl font-semibold text-primary">{metrics.discounts}</div></Card>
        <Card className="p-3 bg-gradient-card border-border/60"><div className="text-xs text-muted-foreground">Descuentos vencidos</div><div className="text-xl font-semibold text-warning">{metrics.expired}</div></Card>
      </div>

      <Card className="p-3 bg-gradient-card border-border/60 flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar cliente…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(PRICE_CHANGE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto"><Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button></div>
      </Card>

      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Anterior</TableHead>
              <TableHead>Nuevo</TableHead>
              <TableHead>% cambio</TableHead>
              <TableHead>Vence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{fmtDate(r.created_at)}</TableCell>
                <TableCell className="font-medium">{r.client?.company_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{PRICE_CHANGE_LABEL[r.change_type] ?? r.change_type}</Badge></TableCell>
                <TableCell className="font-mono text-sm">{r.previous_amount != null ? formatMoney(r.previous_amount, r.currency) : "—"}</TableCell>
                <TableCell className="font-mono text-sm">{r.new_amount != null ? formatMoney(r.new_amount, r.currency) : "—"}</TableCell>
                <TableCell className="font-mono text-sm">{r.percentage_change != null ? `${Number(r.percentage_change).toFixed(1)}%` : "—"}</TableCell>
                <TableCell className="text-sm">{r.discount_ends_at ? fmtDate(r.discount_ends_at) : "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sin registros</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
