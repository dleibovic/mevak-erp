import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  key: string;
  label: string;
  descripcion: string | null;
  category: "informe" | "alerta";
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[] | null;
  config: any;
};

const FREQ_LABELS: Record<string, string> = { daily: "Diario", weekly: "Semanal", monthly: "Mensual" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SettingRow({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const [emails, setEmails] = useState((row.recipients ?? []).join(", "));
  const [umbral, setUmbral] = useState(String(row.config?.umbral_ars ?? ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmails((row.recipients ?? []).join(", "));
    setUmbral(String(row.config?.umbral_ars ?? ""));
  }, [row.id, row.recipients, row.config]);

  const update = async (patch: Record<string, any>, okMsg: string) => {
    const { error } = await (supabase as any)
      .from("notification_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else { toast.success(okMsg); onChanged(); }
  };

  const saveRecipients = async () => {
    const list = emails.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    const invalid = list.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) {
      toast.error(`Emails inválidos: ${invalid.join(", ")}`);
      return;
    }
    setSaving(true);
    await update({ recipients: list }, "Destinatarios guardados");
    setSaving(false);
  };

  const saveUmbral = async () => {
    const n = Number(umbral);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Ingresá un umbral válido (número ≥ 0)");
      return;
    }
    setSaving(true);
    await update({ config: { ...(row.config ?? {}), umbral_ars: n } }, "Umbral guardado");
    setSaving(false);
  };

  return (
    <div className="rounded-md border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{row.label}</span>
            <Badge variant={row.enabled ? "default" : "secondary"} className="text-[10px]">
              {row.enabled ? "Activo" : "Pausado"}
            </Badge>
          </div>
          {row.descripcion && <p className="text-xs text-muted-foreground mt-0.5">{row.descripcion}</p>}
        </div>
        <Switch
          checked={!!row.enabled}
          onCheckedChange={(v) => update({ enabled: v }, v ? "Activado" : "Pausado")}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Frecuencia</Label>
          <Select value={row.frequency} onValueChange={(v) => update({ frequency: v }, "Frecuencia actualizada")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FREQ_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {row.key === "alert_deuda_umbral" && (
          <div>
            <Label className="text-xs">Umbral (ARS)</Label>
            <div className="flex gap-2">
              <Input type="number" min={0} value={umbral} onChange={(e) => setUmbral(e.target.value)} />
              <Button variant="secondary" onClick={saveUmbral} disabled={saving}>Guardar</Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs">Destinatarios (separados por coma)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="mail1@empresa.com, mail2@empresa.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
          <Button variant="secondary" onClick={saveRecipients} disabled={saving}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () =>
      ((await (supabase as any)
        .from("notification_settings")
        .select("*")
        .order("category")
        .order("label")).data ?? []) as Row[],
  });

  const onChanged = () => qc.invalidateQueries({ queryKey: ["notification-settings"] });
  const informes = data.filter((r) => r.category === "informe");
  const alertas = data.filter((r) => r.category === "alerta");

  return (
    <div className="space-y-4 mt-4">
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          Los envíos automáticos requieren tener conectado Resend (proveedor de email). Mientras no esté
          configurado, podés dejar todo listo acá y los mails empezarán a salir cuando se active el envío.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <Card className="p-5 bg-gradient-card border-border/60">
            <h3 className="text-lg font-semibold mb-3">Informes por mail</h3>
            <div className="space-y-3">
              {informes.length ? informes.map((r) => <SettingRow key={r.id} row={r} onChanged={onChanged} />) : (
                <p className="text-sm text-muted-foreground">No hay informes configurados.</p>
              )}
            </div>
          </Card>

          <Card className="p-5 bg-gradient-card border-border/60">
            <h3 className="text-lg font-semibold mb-3">Alertas por mail</h3>
            <div className="space-y-3">
              {alertas.length ? alertas.map((r) => <SettingRow key={r.id} row={r} onChanged={onChanged} />) : (
                <p className="text-sm text-muted-foreground">No hay alertas configuradas.</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
