import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";

const ENTRY_TYPE_LABEL: Record<string, string> = {
  opening: "Saldo inicial",
  freeze: "Congelamiento",
  incobrable_split: "Incobrable (reparto)",
  payment: "Pago",
  adjustment: "Ajuste",
};

const LEDGER_LABEL: Record<string, string> = {
  meri: "Meri",
  empresa: "Empresa",
};

function fmtUsd(n: number) {
  return `US$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Debts() {
  const { isAdmin, roleLoading } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["partner-debts"],
    queryFn: async () =>
      (await supabase.from("partner_debts" as any).select("*").order("entry_date", { ascending: false })).data ?? [],
    enabled: isAdmin,
  });

  if (!roleLoading && !isAdmin) return <Navigate to="/" replace />;

  const entries = rows as any[];
  const totalMeri = entries.filter((r) => r.ledger === "meri").reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  const totalEmpresa = entries.filter((r) => r.ledger === "empresa").reduce((s, r) => s + Number(r.amount_usd || 0), 0);

  return (
    <PageContainer>
      <PageHeader title="Deudas" description="Deudas hacia Darío (Meri y empresa)" />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deuda de Meri hacia mí (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmtUsd(totalMeri)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deuda de la empresa hacia mí (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmtUsd(totalEmpresa)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Monto USD</TableHead>
                  <TableHead>Período origen</TableHead>
                  <TableHead className="text-right">Dólar usado</TableHead>
                  <TableHead className="text-right">Monto ARS original</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando…</TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin movimientos todavía.</TableCell>
                  </TableRow>
                ) : (
                  entries.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.entry_date)}</TableCell>
                      <TableCell>
                        <Badge variant={r.ledger === "meri" ? "default" : "secondary"}>
                          {LEDGER_LABEL[r.ledger] ?? r.ledger}
                        </Badge>
                      </TableCell>
                      <TableCell>{ENTRY_TYPE_LABEL[r.entry_type] ?? r.entry_type}</TableCell>
                      <TableCell className="max-w-[150px] whitespace-normal break-words sm:max-w-[280px] sm:truncate">{r.concept ?? "—"}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap font-medium ${Number(r.amount_usd) < 0 ? "text-destructive" : ""}`}>
                        {fmtUsd(Number(r.amount_usd || 0))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.origin_period ? fmtDate(r.origin_period) : "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {r.origin_rate_ars != null ? `$${Number(r.origin_rate_ars).toLocaleString("es-AR")}` : "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {r.amount_ars_origin != null ? `$${Number(r.amount_ars_origin).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
