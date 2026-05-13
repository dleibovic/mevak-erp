import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { fmtDate, formatMoney } from "@/lib/format";
import { PRICE_CHANGE_LABEL } from "@/lib/billing";
import { ArrowDown, ArrowUp, Tag, TimerOff, Pencil } from "lucide-react";

export function PriceHistoryTimeline({ clientId }: { clientId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["client_price_history", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_price_history")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.created_by).filter(Boolean)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return (data ?? []).map((r: any) => ({ ...r, _creator_name: r.created_by ? names[r.created_by] : null }));
    },
    enabled: !!clientId,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">Sin cambios registrados todavía.</p>;

  return (
    <ol className="relative border-l border-border ml-2 space-y-3">
      {data.map((row: any) => {
        const Icon =
          row.change_type === "increase" ? ArrowUp :
          row.change_type === "decrease" ? ArrowDown :
          row.change_type === "discount_applied" ? Tag :
          row.change_type === "discount_expired" ? TimerOff : Pencil;
        const tone =
          row.change_type === "increase" ? "bg-success/15 text-success" :
          row.change_type === "decrease" ? "bg-destructive/15 text-destructive" :
          row.change_type === "discount_applied" ? "bg-primary/15 text-primary" :
          row.change_type === "discount_expired" ? "bg-warning/15 text-warning" :
          "bg-muted text-muted-foreground";
        return (
          <li key={row.id} className="ml-4">
            <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{PRICE_CHANGE_LABEL[row.change_type] ?? row.change_type}</Badge>
              <span className="text-muted-foreground">{fmtDate(row.created_at)}</span>
              {row._creator_name && <span className="text-xs text-muted-foreground">· {row._creator_name}</span>}
            </div>
            <div className="text-sm font-mono mt-1">
              {row.previous_amount != null && <span className="line-through text-muted-foreground mr-2">{formatMoney(row.previous_amount, row.currency)}</span>}
              {row.new_amount != null && <span className="font-semibold">{formatMoney(row.new_amount, row.currency)}</span>}
              {row.percentage_change != null && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {row.percentage_change > 0 ? "+" : ""}{row.percentage_change}%
                </Badge>
              )}
            </div>
            {row.reason && <p className="text-xs text-muted-foreground mt-1">{row.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}
