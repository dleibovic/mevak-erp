import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries, usePlatforms, useExpenseCategories, useContactChannels, useLostReasons, useFunnelStages } from "@/hooks/useCatalogs";
import { CheckCircle2, Pencil, Plus, SearchCheck, Trash2 } from "lucide-react";
import { COUNTRY_OPTIONS, flagForCountry } from "@/lib/countries";
import { toast } from "sonner";

const REGIONAL_PLATFORM_CATALOG = {
  USA: ["DoorDash", "Grubhub", "Uber Eats", "Postmates", "Caviar", "Seamless", "ChowNow", "Toast TakeOut"],
  LATAM: ["Rappi", "PedidosYa", "DiDi Food", "Uber Eats", "Yummy", "Hugo"],
  España: ["Just Eat", "Glovo", "Uber Eats"],
  Brasil: ["iFood", "Aiqfome", "Rappi"],
} as const;

const normalizePlatformName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function Admin() {
  return (
    <PageContainer>
      <PageHeader title="Configuración" description="Catálogos y administración del sistema" />
      <Tabs defaultValue="platforms">
        <TabsList>
          <TabsTrigger value="platforms">Plataformas</TabsTrigger>
          <TabsTrigger value="categories">Categorías de gastos</TabsTrigger>
          <TabsTrigger value="countries">Países</TabsTrigger>
          <TabsTrigger value="prospecting">Prospecting</TabsTrigger>
          <TabsTrigger value="users">Usuarios y roles</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms"><PlatformsManager /></TabsContent>
        <TabsContent value="categories"><CatalogManager table="expense_categories" hook={useExpenseCategories} label="categoría" /></TabsContent>
        <TabsContent value="countries"><CountriesManager /></TabsContent>
        <TabsContent value="prospecting"><ProspectingSettings /></TabsContent>
        <TabsContent value="users"><UsersManager /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function CatalogManager({ table, hook, label }: { table: "platforms" | "expense_categories"; hook: any; label: string }) {
  const qc = useQueryClient();
  const { data = [] } = hook();
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from(table).insert({ name }); if (error) throw error; },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: [table] }); toast.success("Agregado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from(table).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 bg-gradient-card border-border/60 mt-4">
      <div className="flex gap-2 mb-4">
        <Input placeholder={`Nueva ${label}`} value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => add.mutate()} disabled={!name}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </div>
      <div className="space-y-1">
        {data.map((it: any) => (
          <div key={it.id} className="flex justify-between items-center px-3 py-2 rounded-md hover:bg-card/60">
            <span>{it.name}</span>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlatformsManager() {
  const qc = useQueryClient();
  const { data = [] } = usePlatforms();
  const [name, setName] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  const existingNames = useMemo(() => new Set(data.map((p: any) => normalizePlatformName(p.name))), [data]);
  const missingByRegion = useMemo(() => Object.entries(REGIONAL_PLATFORM_CATALOG).map(([region, platforms]) => ({
    region,
    platforms: platforms.filter((platform) => !existingNames.has(normalizePlatformName(platform))),
  })), [existingNames]);
  const missingUnique = useMemo(() => Array.from(new Map(missingByRegion.flatMap((item) => item.platforms).map((platform) => [normalizePlatformName(platform), platform])).values()), [missingByRegion]);

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("platforms").insert({ name }); if (error) throw error; },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["platforms"] }); toast.success("Agregado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const addMissing = useMutation({
    mutationFn: async () => {
      if (!missingUnique.length) return;
      const { error } = await supabase.from("platforms").insert(missingUnique.map((platform) => ({ name: platform })));
      if (error) throw error;
    },
    onSuccess: () => { setSummaryOpen(false); qc.invalidateQueries({ queryKey: ["platforms"] }); toast.success("Plataformas faltantes agregadas"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("platforms").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platforms"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 bg-gradient-card border-border/60 mt-4">
      <div className="flex flex-col gap-2 mb-4 md:flex-row">
        <Input placeholder="Nueva plataforma" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => add.mutate()} disabled={!name}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
        <Button variant="secondary" onClick={() => setSummaryOpen(true)}><SearchCheck className="h-4 w-4 mr-1" />Validar faltantes</Button>
      </div>
      <div className="space-y-1">
        {data.map((it: any) => (
          <div key={it.id} className="flex justify-between items-center px-3 py-2 rounded-md hover:bg-card/60">
            <span>{it.name}</span>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resumen de plataformas faltantes</DialogTitle>
            <DialogDescription>Validación automática para USA, LATAM, España y Brasil antes de insertar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {missingByRegion.map((item) => (
              <div key={item.region} className="rounded-md border border-border bg-card/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-medium">{item.region}</h4>
                  <span className="text-xs text-muted-foreground">{item.platforms.length} faltantes</span>
                </div>
                {item.platforms.length ? <div className="flex flex-wrap gap-1.5">{item.platforms.map((platform) => <span key={platform} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{platform}</span>)}</div> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />Completo</div>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMissing.mutate()} disabled={!missingUnique.length || addMissing.isPending}>Insertar {missingUnique.length} plataformas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CountriesManager() {
  const qc = useQueryClient();
  const { data = [] } = useCountries();
  const [selected, setSelected] = useState<string>("");
  const [editing, setEditing] = useState<{ id: string; name: string; currency_code: string; currency_symbol: string } | null>(null);

  const existingNames = useMemo(() => new Set((data as any[]).map((c) => c.name.trim().toLowerCase())), [data]);
  const available = COUNTRY_OPTIONS.filter((c) => !existingNames.has(c.name.toLowerCase()));

  const add = useMutation({
    mutationFn: async () => {
      const opt = COUNTRY_OPTIONS.find((c) => c.iso2 === selected);
      if (!opt) throw new Error("Elegí un país");
      const { error } = await supabase.from("countries").insert({ name: opt.name, currency_code: opt.currency_code, currency_symbol: opt.currency_symbol });
      if (error) throw error;
    },
    onSuccess: () => { setSelected(""); qc.invalidateQueries({ queryKey: ["countries"] }); toast.success("País agregado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("countries").update({ name: editing.name, currency_code: editing.currency_code, currency_symbol: editing.currency_symbol }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["countries"] }); toast.success("País actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("countries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["countries"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 bg-gradient-card border-border/60 mt-4">
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="md:w-80"><SelectValue placeholder="Seleccionar país a agregar" /></SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.iso2} value={c.iso2}>
                <span className="mr-2">{c.flag}</span>{c.name} <span className="text-muted-foreground ml-1">({c.currency_code})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => add.mutate()} disabled={!selected || add.isPending}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </div>
      <div className="space-y-2">
        {(data as any[]).map((c) => (
          <div key={c.id} className="flex justify-between items-center px-3 py-2 rounded-md bg-card/40 border border-border">
            <div className="flex items-center gap-2">
              <span className="text-xl">{flagForCountry(c.name)}</span>
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-muted-foreground">{c.currency_code} ({c.currency_symbol})</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditing({ id: c.id, name: c.name, currency_code: c.currency_code, currency_symbol: c.currency_symbol })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar ${c.name}?`)) del.mutate(c.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar país</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Código de moneda</Label><Input value={editing.currency_code} onChange={(e) => setEditing({ ...editing, currency_code: e.target.value })} /></div>
              <div><Label>Símbolo</Label><Input value={editing.currency_symbol} onChange={(e) => setEditing({ ...editing, currency_symbol: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ProspectingSettings() {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <ContactChannelsManager />
      <LostReasonsManager />
      <FunnelStagesManager />
      <AlertSettingsManager />
    </div>
  );
}

function ContactChannelsManager() {
  const qc = useQueryClient();
  const { data = [] } = useContactChannels();
  const [name, setName] = useState("");
  const [type, setType] = useState("social");
  const add = useMutation({ mutationFn: async () => { const { error } = await (supabase as any).from("contact_channels").insert({ name, type, is_active: true }); if (error) throw error; }, onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["contact_channels"] }); toast.success("Canal agregado"); }, onError: (e: any) => toast.error(e.message) });
  const update = useMutation({ mutationFn: async ({ id, patch }: any) => { const { error } = await (supabase as any).from("contact_channels").update(patch).eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["contact_channels"] }) });
  const del = useMutation({ mutationFn: async (id: string) => { const { error } = await (supabase as any).from("contact_channels").delete().eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["contact_channels"] }) });
  return <Card className="p-5 bg-gradient-card border-border/60"><h3 className="font-medium mb-3">Canales de contacto</h3><div className="flex gap-2 mb-4"><Input placeholder="Nuevo canal" value={name} onChange={(e) => setName(e.target.value)} /><Input className="w-32" placeholder="Tipo" value={type} onChange={(e) => setType(e.target.value)} /><Button onClick={() => add.mutate()} disabled={!name}><Plus className="h-4 w-4" /></Button></div><div className="space-y-2">{data.map((c: any) => <div key={c.id} className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-2"><Input value={c.name} onChange={(e) => update.mutate({ id: c.id, patch: { name: e.target.value } })} /><Switch checked={c.is_active} onCheckedChange={(v) => update.mutate({ id: c.id, patch: { is_active: v } })} /><Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div></Card>;
}

function LostReasonsManager() {
  const qc = useQueryClient();
  const { data = [] } = useLostReasons();
  const [reason, setReason] = useState("");
  const add = useMutation({ mutationFn: async () => { const { error } = await (supabase as any).from("lost_reasons").insert({ reason }); if (error) throw error; }, onSuccess: () => { setReason(""); qc.invalidateQueries({ queryKey: ["lost_reasons"] }); toast.success("Motivo agregado"); }, onError: (e: any) => toast.error(e.message) });
  const del = useMutation({ mutationFn: async (id: string) => { const { error } = await (supabase as any).from("lost_reasons").delete().eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["lost_reasons"] }) });
  return <Card className="p-5 bg-gradient-card border-border/60"><h3 className="font-medium mb-3">Motivos de pérdida</h3><div className="flex gap-2 mb-4"><Input placeholder="Nuevo motivo" value={reason} onChange={(e) => setReason(e.target.value)} /><Button onClick={() => add.mutate()} disabled={!reason}><Plus className="h-4 w-4" /></Button></div><div className="space-y-2">{data.map((r: any) => <div key={r.id} className="flex items-center justify-between rounded-md border border-border bg-card/40 p-2"><span>{r.reason}</span><Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div></Card>;
}

function FunnelStagesManager() {
  const qc = useQueryClient();
  const { data = [] } = useFunnelStages();
  const update = useMutation({ mutationFn: async ({ id, patch }: any) => { const { error } = await (supabase as any).from("funnel_stages").update(patch).eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["funnel_stages"] }) });
  return <Card className="p-5 bg-gradient-card border-border/60"><h3 className="font-medium mb-3">Etapas del funnel</h3><div className="space-y-2">{data.map((s: any) => <div key={s.id} className="grid grid-cols-12 gap-2 rounded-md border border-border bg-card/40 p-2"><Input className="col-span-7" value={s.name} onChange={(e) => update.mutate({ id: s.id, patch: { name: e.target.value } })} /><Input className="col-span-2" type="number" value={s.stage_order} onChange={(e) => update.mutate({ id: s.id, patch: { stage_order: Number(e.target.value) } })} /><Input className="col-span-3" value={s.color} onChange={(e) => update.mutate({ id: s.id, patch: { color: e.target.value } })} /></div>)}</div></Card>;
}

function AlertSettingsManager() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["alert_settings"], queryFn: async () => ((await (supabase as any).from("alert_settings").select("*").eq("id", 1).single()).data) });
  const [emails, setEmails] = useState("");
  const update = useMutation({ mutationFn: async (patch: any) => { const { error } = await (supabase as any).from("alert_settings").update(patch).eq("id", 1); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["alert_settings"] }); toast.success("Configuración actualizada"); } });
  return <Card className="p-5 bg-gradient-card border-border/60"><h3 className="font-medium mb-3">Alertas de inactividad</h3><div className="space-y-3"><div><Label>Umbral en días</Label><Input type="number" min={1} value={settings?.inactivity_threshold_days ?? 7} onChange={(e) => update.mutate({ inactivity_threshold_days: Number(e.target.value) })} /></div><div className="flex items-center justify-between rounded-md border border-border bg-card/40 p-3"><span className="text-sm">Alertas automáticas activas</span><Switch checked={!!settings?.is_inactivity_alert_active} onCheckedChange={(v) => update.mutate({ is_inactivity_alert_active: v })} /></div><div><Label>Emails por defecto</Label><div className="flex gap-2"><Input placeholder={(settings?.default_notify_emails ?? []).join(", ") || "mail@empresa.com"} value={emails} onChange={(e) => setEmails(e.target.value)} /><Button onClick={() => update.mutate({ default_notify_emails: emails.split(",").map((x) => x.trim()).filter(Boolean) })}>Guardar</Button></div></div></div></Card>;
}

function UsersManager() {
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*, user_roles(role)")).data ?? [],
  });
  return (
    <Card className="p-5 bg-gradient-card border-border/60 mt-4">
      <p className="text-sm text-muted-foreground mb-3">Los roles se asignan automáticamente: el primer usuario es Admin, los siguientes son Ejecutivos. Para cambiar roles, hacelo desde la base de datos en la consola de Cloud.</p>
      <div className="space-y-2">
        {profiles.map((p: any) => (
          <div key={p.id} className="flex justify-between items-center px-3 py-2 rounded-md bg-card/40 border border-border">
            <div>
              <div className="font-medium">{p.full_name ?? p.email}</div>
              <div className="text-xs text-muted-foreground">{p.email}</div>
            </div>
            <div className="flex gap-1">
              {p.user_roles?.map((r: any, i: number) => (
                <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">{r.role}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
