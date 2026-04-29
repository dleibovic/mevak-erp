import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, CalendarClock, Download, Eye, KanbanSquare, List, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCountries, usePlatforms } from "@/hooks/useCatalogs";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { fmtDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";

type Prospect = any;
type ViewMode = "list" | "kanban" | "dashboard";

const STAGE_CLASS: Record<string, string> = {
  gray: "bg-muted text-muted-foreground border-border",
  blue: "bg-primary/10 text-primary border-primary/30",
  sky: "bg-accent/60 text-accent-foreground border-accent",
  purple: "bg-secondary text-secondary-foreground border-secondary",
  orange: "bg-warning/10 text-warning border-warning/30",
  yellow: "bg-warning/20 text-warning border-warning/40",
  green: "bg-success/10 text-success border-success/30",
  red: "bg-destructive/10 text-destructive border-destructive/30",
};

const flagFor = (name?: string) => name?.toLowerCase().includes("espa") ? "🇪🇸" : name?.toLowerCase().includes("arg") ? "🇦🇷" : "🌎";
const daysBetween = (from?: string | null, to = new Date()) => from ? Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 86400000)) : 0;
const toDateInput = (d?: string | null) => d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

function useProspectCatalogs() {
  const { data: stages = [] } = useQuery({ queryKey: ["funnel_stages"], queryFn: async () => ((await (supabase as any).from("funnel_stages").select("*").order("stage_order")).data ?? []) });
  const { data: channels = [] } = useQuery({ queryKey: ["contact_channels"], queryFn: async () => ((await (supabase as any).from("contact_channels").select("*").eq("is_active", true).order("name")).data ?? []) });
  const { data: lostReasons = [] } = useQuery({ queryKey: ["lost_reasons"], queryFn: async () => ((await (supabase as any).from("lost_reasons").select("*").order("reason")).data ?? []) });
  const { data: settings } = useQuery({ queryKey: ["alert_settings"], queryFn: async () => ((await (supabase as any).from("alert_settings").select("*").eq("id", 1).maybeSingle()).data ?? null) });
  return { stages, channels, lostReasons, settings };
}

function useCurrentEmployee() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current_employee", user?.id],
    enabled: !!user?.id,
    queryFn: async () => ((await supabase.from("employees").select("*").eq("user_id", user!.id).maybeSingle()).data),
  });
}

export default function Prospecting() {
  const qc = useQueryClient();
  const { countryId, countries } = useCountryFilter();
  const { isAdmin } = useAuth();
  const { stages, channels } = useProspectCatalogs();
  const [mode, setMode] = useState<ViewMode>("list");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Prospect | null>(null);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [executiveFilter, setExecutiveFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  const { data: employees = [] } = useQuery({ queryKey: ["employees-prospecting"], queryFn: async () => ((await supabase.from("employees").select("id, full_name, user_id, is_active").eq("is_active", true).order("full_name")).data ?? []) });

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["prospects", countryId],
    queryFn: async () => {
      let q = (supabase as any).from("prospects").select("*, country:countries(*), first_channel:contact_channels(*), stage:funnel_stages(*), executive:employees(id,full_name), lost_reason:lost_reasons(*), platforms:prospect_platforms(*, platform:platforms(*)), alerts:prospect_alerts(*), interactions:prospect_interactions(*, channel:contact_channels(*), stage:funnel_stages(*), employee:employees(id,full_name)), stage_history:prospect_stage_history(*, stage:funnel_stages(*))").order("created_at", { ascending: false });
      if (countryId) q = q.eq("country_id", countryId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => prospects.filter((p: any) => {
    const term = search.toLowerCase();
    return (!term || p.business_name?.toLowerCase().includes(term) || p.contact_name?.toLowerCase().includes(term))
      && (stageFilter === "all" || p.current_stage_id === stageFilter)
      && (executiveFilter === "all" || p.assigned_executive_id === executiveFilter)
      && (channelFilter === "all" || p.first_contact_channel_id === channelFilter)
      && (currencyFilter === "all" || p.currency === currencyFilter);
  }), [prospects, search, stageFilter, executiveFilter, channelFilter, currencyFilter]);

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("prospects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Prospecto eliminado"); qc.invalidateQueries({ queryKey: ["prospects"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCsv = () => {
    const rows = filtered.map((p: any) => ({ Empresa: p.business_name, Contacto: p.contact_name ?? "", Pais: p.country?.name ?? "", Ciudad: p.city ?? "", Ejecutivo: p.executive?.full_name ?? "", Etapa: p.stage?.name ?? "", Canal: p.first_channel?.name ?? "", Revenue: p.estimated_monthly_revenue, Moneda: p.currency, Estado: p.status }));
    const csv = [Object.keys(rows[0] ?? { Empresa: "" }).join(","), ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "prospectos.csv";
    a.click();
  };

  return (
    <PageContainer>
      <PageHeader title="Prospecting & Pipeline" description="Prospectos, embudo comercial, alertas y conversión a clientes" actions={<><Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" />Nuevo prospecto</Button></>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar empresa o contacto..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Etapa" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las etapas</SelectItem>{stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Select value={executiveFilter} onValueChange={setExecutiveFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Ejecutivo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Canal" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los canales</SelectItem>{channels.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ARS/EUR</SelectItem><SelectItem value="ARS">ARS</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select>
        <div className="ml-auto flex rounded-md border border-border bg-card/40 p-1">
          <Button size="sm" variant={mode === "list" ? "secondary" : "ghost"} onClick={() => setMode("list")}><List className="h-4 w-4" /></Button>
          <Button size="sm" variant={mode === "kanban" ? "secondary" : "ghost"} onClick={() => setMode("kanban")}><KanbanSquare className="h-4 w-4" /></Button>
          <Button size="sm" variant={mode === "dashboard" ? "secondary" : "ghost"} onClick={() => setMode("dashboard")}>Dashboard</Button>
        </div>
      </div>

      {mode === "dashboard" ? <ProspectingDashboard prospects={filtered} stages={stages} countries={countries} employees={employees} /> : mode === "kanban" ? <KanbanView prospects={filtered} stages={stages} onOpen={setDetail} /> : <ListView prospects={filtered} isLoading={isLoading} onOpen={setDetail} onEdit={(p) => { setEditing(p); setOpen(true); }} onDelete={(id) => del.mutate(id)} isAdmin={isAdmin} />}

      <ProspectDialog open={open} onOpenChange={setOpen} prospect={editing} stages={stages} employees={employees} />
      <ProspectDetail prospect={detail} onOpenChange={(v) => !v && setDetail(null)} stages={stages} employees={employees} onEdit={(p) => { setDetail(null); setEditing(p); setOpen(true); }} />
    </PageContainer>
  );
}

function StageBadge({ stage }: { stage: any }) {
  return <Badge variant="outline" className={cn("border", STAGE_CLASS[stage?.color] ?? STAGE_CLASS.gray)}>{stage?.name ?? "—"}</Badge>;
}

function AlertPill({ prospect }: { prospect: any }) {
  const active = (prospect.alerts ?? []).filter((a: any) => !a.is_dismissed && !a.is_sent);
  if (!active.length) return <span className="text-muted-foreground">—</span>;
  return <Badge variant="destructive" className="gap-1"><Bell className="h-3 w-3" />{active.length}</Badge>;
}

function ListView({ prospects, isLoading, onOpen, onEdit, onDelete, isAdmin }: any) {
  if (isLoading) return <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/60">Cargando...</Card>;
  if (!prospects.length) return <EmptyState title="Sin prospectos" description="Cargá tu primer prospecto para iniciar el pipeline" />;
  return <Card className="overflow-hidden bg-gradient-card border-border/60"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Contacto</TableHead><TableHead>País/Ciudad</TableHead><TableHead>Ejecutivo</TableHead><TableHead>Etapa</TableHead><TableHead>Primer contacto</TableHead><TableHead>Revenue</TableHead><TableHead>Días etapa</TableHead><TableHead>Alertas</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{prospects.map((p: any) => <TableRow key={p.id}><TableCell className="font-medium">{p.business_name}</TableCell><TableCell><div>{p.contact_name ?? "—"}</div><div className="text-xs text-muted-foreground">{p.email ?? p.phone ?? ""}</div></TableCell><TableCell>{flagFor(p.country?.name)} {p.country?.name}<div className="text-xs text-muted-foreground">{p.city ?? "—"}</div></TableCell><TableCell>{p.executive?.full_name ?? "—"}</TableCell><TableCell><StageBadge stage={p.stage} /></TableCell><TableCell>{fmtDate(p.first_contact_date)}<div className="text-xs text-muted-foreground">{p.first_channel?.name ?? "—"}</div></TableCell><TableCell>{formatMoney(p.estimated_monthly_revenue, p.currency)}</TableCell><TableCell>{daysBetween(p.stage_entered_at)} días</TableCell><TableCell><AlertPill prospect={p} /></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => onOpen(p)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>{isAdmin && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar prospecto?</AlertDialogTitle><AlertDialogDescription>Esta acción elimina el prospecto y su historial.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(p.id)}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</TableCell></TableRow>)}</TableBody></Table></Card>;
}

function KanbanView({ prospects, stages, onOpen }: any) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor));
  const moveStage = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      const { error } = await (supabase as any).from("prospects").update({ current_stage_id: stageId, stage_entered_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await (supabase as any).from("prospect_stage_history").insert({ prospect_id: id, stage_id: stageId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prospects"] }); toast.success("Etapa actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const onDragEnd = (event: DragEndEvent) => { const targetStageId = event.over?.data.current?.stageId ?? event.over?.id; if (!targetStageId || event.active.data.current?.stageId === targetStageId) return; moveStage.mutate({ id: String(event.active.id), stageId: String(targetStageId) }); };
  return <DndContext sensors={sensors} onDragEnd={onDragEnd}><div className="grid min-h-[620px] auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">{stages.map((stage: any) => { const rows = prospects.filter((p: any) => p.current_stage_id === stage.id); return <KanbanColumn key={stage.id} stage={stage} rows={rows} onOpen={onOpen} />; })}</div></DndContext>;
}

function KanbanColumn({ stage, rows, onOpen }: any) {
  const { setNodeRef } = useDroppable({ id: stage.id, data: { stageId: stage.id } });
  return <SortableContext items={rows.map((p: any) => p.id)} strategy={verticalListSortingStrategy}><div ref={setNodeRef} className="rounded-md border border-border bg-card/30 p-3"><div className="mb-3 flex items-center justify-between"><StageBadge stage={stage} /><span className="text-xs text-muted-foreground">{rows.length}</span></div><div className="space-y-2">{rows.map((p: any) => <ProspectCard key={p.id} prospect={p} onOpen={onOpen} />)}</div></div></SortableContext>;
}

function ProspectCard({ prospect, onOpen }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: prospect.id, data: { stageId: prospect.current_stage_id } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} onDoubleClick={() => onOpen(prospect)} className="cursor-grab rounded-md border border-border bg-background p-3 shadow-sm active:cursor-grabbing"><div className="font-medium leading-tight">{prospect.business_name}</div><div className="mt-1 text-xs text-muted-foreground">{flagFor(prospect.country?.name)} {prospect.city ?? prospect.country?.name}</div><div className="mt-3 flex items-center justify-between text-xs"><span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{prospect.executive?.full_name?.slice(0, 12) ?? "—"}</span><span>{formatMoney(prospect.estimated_monthly_revenue, prospect.currency)}</span></div><div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{daysBetween(prospect.stage_entered_at)} días</span><AlertPill prospect={prospect} /></div></div>;
}

function ProspectDialog({ open, onOpenChange, prospect, stages, employees }: any) {
  const qc = useQueryClient();
  const { data: countries = [] } = useCountries();
  const { data: platforms = [] } = usePlatforms();
  const { channels } = useProspectCatalogs();
  const { data: currentEmployee } = useCurrentEmployee();
  const firstStage = stages[0];
  const [form, setForm] = useState<any>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({});

  useMemo(() => {
    if (!open) return;
    if (prospect) {
      setForm({ ...prospect, first_contact_date: toDateInput(prospect.first_contact_date) });
      const sp: Record<string, boolean> = {}; prospect.platforms?.forEach((p: any) => { sp[p.platform_id] = true; }); setSelectedPlatforms(sp);
    } else {
      const c = countries[0];
      setForm({ business_name: "", contact_name: "", phone: "", email: "", country_id: c?.id ?? "", city: "", currency: c?.currency_code ?? "ARS", estimated_monthly_revenue: 0, first_contact_date: toDateInput(), first_contact_channel_id: null, current_stage_id: firstStage?.id, assigned_executive_id: currentEmployee?.id ?? null, notes: "" });
      setSelectedPlatforms({});
    }
  }, [open, prospect?.id, countries.length, firstStage?.id, currentEmployee?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { business_name: form.business_name, contact_name: form.contact_name || null, phone: form.phone || null, email: form.email || null, country_id: form.country_id, city: form.city || null, estimated_monthly_revenue: Number(form.estimated_monthly_revenue) || 0, currency: form.currency, first_contact_date: form.first_contact_date, first_contact_channel_id: form.first_contact_channel_id || null, current_stage_id: form.current_stage_id, assigned_executive_id: form.assigned_executive_id, notes: form.notes || null, created_by_employee_id: prospect?.created_by_employee_id ?? currentEmployee?.id ?? form.assigned_executive_id };
      let id = prospect?.id;
      if (id) { const { error } = await (supabase as any).from("prospects").update(payload).eq("id", id); if (error) throw error; }
      else { const { data, error } = await (supabase as any).from("prospects").insert(payload).select().single(); if (error) throw error; id = data.id; await (supabase as any).from("prospect_stage_history").insert({ prospect_id: id, stage_id: payload.current_stage_id, changed_by_employee_id: currentEmployee?.id }); }
      await (supabase as any).from("prospect_platforms").delete().eq("prospect_id", id);
      const rows = Object.entries(selectedPlatforms).filter(([, v]) => v).map(([platform_id]) => ({ prospect_id: id, platform_id }));
      if (rows.length) await (supabase as any).from("prospect_platforms").insert(rows);
    },
    onSuccess: () => { toast.success(prospect ? "Prospecto actualizado" : "Prospecto creado"); qc.invalidateQueries({ queryKey: ["prospects"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{prospect ? "Editar prospecto" : "Nuevo prospecto"}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-4"><div><Label>Empresa *</Label><Input value={form.business_name ?? ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></div><div><Label>Contacto</Label><Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div><div><Label>Teléfono</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div><div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div><Label>País *</Label><Select value={form.country_id ?? ""} onValueChange={(v) => { const c = countries.find((x: any) => x.id === v); setForm({ ...form, country_id: v, currency: c?.currency_code ?? form.currency }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{flagFor(c.name)} {c.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Ciudad</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div><Label>Revenue estimado</Label><div className="flex gap-2"><Input type="number" step="0.01" value={form.estimated_monthly_revenue ?? 0} onChange={(e) => setForm({ ...form, estimated_monthly_revenue: e.target.value })} /><Select value={form.currency ?? "ARS"} onValueChange={(v) => setForm({ ...form, currency: v })}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div></div><div><Label>Primer contacto</Label><Input type="date" value={form.first_contact_date ?? toDateInput()} onChange={(e) => setForm({ ...form, first_contact_date: e.target.value })} /></div><div><Label>Canal inicial</Label><Select value={form.first_contact_channel_id ?? "none"} onValueChange={(v) => setForm({ ...form, first_contact_channel_id: v === "none" ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin canal</SelectItem>{channels.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Etapa</Label><Select value={form.current_stage_id ?? ""} onValueChange={(v) => setForm({ ...form, current_stage_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Ejecutivo</Label><Select value={form.assigned_executive_id ?? "none"} onValueChange={(v) => setForm({ ...form, assigned_executive_id: v === "none" ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin asignar</SelectItem>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2"><Label>Plataformas actuales</Label><div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-border bg-card/40 p-3">{platforms.map((p: any) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!selectedPlatforms[p.id]} onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, [p.id]: e.target.checked })} />{p.name}</label>)}</div></div><div className="col-span-2"><Label>Notas</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!form.business_name || !form.country_id || !form.current_stage_id || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ProspectDetail({ prospect, onOpenChange, stages, employees, onEdit }: any) {
  const qc = useQueryClient();
  const { channels, lostReasons, settings } = useProspectCatalogs();
  const { data: currentEmployee } = useCurrentEmployee();
  const [interaction, setInteraction] = useState<any>({ interaction_date: toDateInput(), channel_id: null, notes: "", next_stage_id: "same" });
  const [alert, setAlert] = useState<any>({ title: "", description: "", alert_type: "fixed_date", alert_date: toDateInput(), relative_days: 1, notify_emails: "" });
  const [lostReason, setLostReason] = useState<string>("");
  const [convertOpen, setConvertOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["prospects"] });
  const stageIndex = stages.findIndex((s: any) => s.id === prospect?.current_stage_id);
  const lastInteraction = prospect?.last_interaction_at ?? prospect?.interactions?.[0]?.interaction_date ?? prospect?.first_contact_date;
  const inactiveDays = daysBetween(lastInteraction);

  const addInteraction = useMutation({ mutationFn: async () => { const nextStage = interaction.next_stage_id !== "same" ? interaction.next_stage_id : prospect.current_stage_id; const { error } = await (supabase as any).from("prospect_interactions").insert({ prospect_id: prospect.id, interaction_date: interaction.interaction_date, channel_id: interaction.channel_id, stage_at_interaction_id: prospect.current_stage_id, notes: interaction.notes, created_by: currentEmployee?.id }); if (error) throw error; await (supabase as any).from("prospects").update({ last_interaction_at: new Date(interaction.interaction_date).toISOString(), current_stage_id: nextStage, stage_entered_at: nextStage !== prospect.current_stage_id ? new Date().toISOString() : prospect.stage_entered_at }).eq("id", prospect.id); if (nextStage !== prospect.current_stage_id) await (supabase as any).from("prospect_stage_history").insert({ prospect_id: prospect.id, stage_id: nextStage, changed_by_employee_id: currentEmployee?.id }); }, onSuccess: () => { toast.success("Interacción registrada"); refresh(); setInteraction({ interaction_date: toDateInput(), channel_id: null, notes: "", next_stage_id: "same" }); }, onError: (e: any) => toast.error(e.message) });
  const addAlert = useMutation({ mutationFn: async () => { const emails = String(alert.notify_emails || settings?.default_notify_emails?.join(",") || "").split(",").map((x) => x.trim()).filter(Boolean); const d = alert.alert_type === "relative_days" ? new Date(Date.now() + Number(alert.relative_days || 1) * 86400000) : new Date(alert.alert_date); const { error } = await (supabase as any).from("prospect_alerts").insert({ prospect_id: prospect.id, title: alert.title, description: alert.description || null, alert_type: alert.alert_type, alert_date: d.toISOString(), relative_days: alert.alert_type === "relative_days" ? Number(alert.relative_days) : null, notify_emails: emails, created_by: currentEmployee?.id }); if (error) throw error; }, onSuccess: () => { toast.success("Alerta creada"); refresh(); setAlert({ title: "", description: "", alert_type: "fixed_date", alert_date: toDateInput(), relative_days: 1, notify_emails: "" }); }, onError: (e: any) => toast.error(e.message) });
  const moveStage = useMutation({ mutationFn: async (dir: number) => { const next = stages[stageIndex + dir]; if (!next) return; if (next.name === "Cerrado Perdido" && !lostReason) throw new Error("Seleccioná un motivo de pérdida"); if (next.name === "Cerrado Ganado") { setConvertOpen(true); return; } const payload: any = { current_stage_id: next.id, stage_entered_at: new Date().toISOString(), status: next.name === "Cerrado Perdido" ? "lost" : prospect.status, lost_reason_id: next.name === "Cerrado Perdido" ? lostReason : null }; const { error } = await (supabase as any).from("prospects").update(payload).eq("id", prospect.id); if (error) throw error; await (supabase as any).from("prospect_stage_history").insert({ prospect_id: prospect.id, stage_id: next.id, changed_by_employee_id: currentEmployee?.id }); }, onSuccess: () => { refresh(); toast.success("Etapa actualizada"); }, onError: (e: any) => toast.error(e.message) });
  const dismissAlert = useMutation({ mutationFn: async (id: string) => { const { error } = await (supabase as any).from("prospect_alerts").update({ is_dismissed: true }).eq("id", id); if (error) throw error; }, onSuccess: refresh });

  if (!prospect) return null;
  return <Dialog open={!!prospect} onOpenChange={onOpenChange}><DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-3"><span>{prospect.business_name}</span><StageBadge stage={prospect.stage} /><Badge variant={prospect.status === "active" ? "secondary" : prospect.status === "converted" ? "default" : "destructive"}>{prospect.status}</Badge></DialogTitle><div className="text-sm text-muted-foreground">{flagFor(prospect.country?.name)} {prospect.country?.name} · {prospect.city ?? "Sin ciudad"} · {prospect.executive?.full_name ?? "Sin ejecutivo"}</div></DialogHeader><Tabs defaultValue="info"><TabsList className="grid w-full grid-cols-4"><TabsTrigger value="info">Información</TabsTrigger><TabsTrigger value="history">Interacciones</TabsTrigger><TabsTrigger value="funnel">Funnel</TabsTrigger><TabsTrigger value="alerts">Alertas</TabsTrigger></TabsList><TabsContent value="info" className="space-y-4"><div className="grid grid-cols-3 gap-3"><Info label="Contacto" value={prospect.contact_name} /><Info label="Teléfono" value={prospect.phone} /><Info label="Email" value={prospect.email} /><Info label="Revenue" value={formatMoney(prospect.estimated_monthly_revenue, prospect.currency)} /><Info label="Canal inicial" value={prospect.first_channel?.name} /><Info label="Primer contacto" value={fmtDate(prospect.first_contact_date)} /></div><div className="flex flex-wrap gap-2">{prospect.platforms?.map((p: any) => <Badge key={p.id} variant="secondary">{p.platform?.name}</Badge>)}</div><Card className="p-4 bg-card/40"><Label>Notas</Label><p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{prospect.notes || "—"}</p></Card><Button onClick={() => onEdit(prospect)}><Pencil className="h-4 w-4" />Editar datos</Button></TabsContent><TabsContent value="history" className="space-y-4"><Card className="p-4 bg-card/40"><div className="grid grid-cols-2 gap-3"><Input type="date" value={interaction.interaction_date} onChange={(e) => setInteraction({ ...interaction, interaction_date: e.target.value })} /><Select value={interaction.channel_id ?? "none"} onValueChange={(v) => setInteraction({ ...interaction, channel_id: v === "none" ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Canal</SelectItem>{channels.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Select value={interaction.next_stage_id} onValueChange={(v) => setInteraction({ ...interaction, next_stage_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="same">Mantener etapa</SelectItem>{stages.map((s: any) => <SelectItem key={s.id} value={s.id}>Mover a {s.name}</SelectItem>)}</SelectContent></Select><Button onClick={() => addInteraction.mutate()} disabled={!interaction.notes}>Registrar interacción</Button><Textarea className="col-span-2" placeholder="Notas de la interacción" value={interaction.notes} onChange={(e) => setInteraction({ ...interaction, notes: e.target.value })} /></div></Card><div className="space-y-3">{(prospect.interactions ?? []).sort((a: any, b: any) => +new Date(b.interaction_date) - +new Date(a.interaction_date)).map((it: any) => <div key={it.id} className="border-l-2 border-primary pl-4"><div className="text-sm font-medium">{fmtDate(it.interaction_date)} · {it.channel?.name ?? "Sin canal"}</div><div className="text-xs text-muted-foreground">{it.stage?.name ?? "—"} · {it.employee?.full_name ?? "—"}</div><p className="mt-1 text-sm">{it.notes}</p></div>)}</div></TabsContent><TabsContent value="funnel" className="space-y-4"><div className="flex flex-wrap items-center gap-2">{stages.map((s: any, i: number) => <div key={s.id} className={cn("rounded-md border px-3 py-2 text-xs", i <= stageIndex ? STAGE_CLASS[s.color] : "bg-card/40 text-muted-foreground border-border")}>{s.name}</div>)}</div>{stages[stageIndex + 1]?.name === "Cerrado Perdido" && <Select value={lostReason} onValueChange={setLostReason}><SelectTrigger className="max-w-sm"><SelectValue placeholder="Motivo de pérdida requerido" /></SelectTrigger><SelectContent>{lostReasons.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.reason}</SelectItem>)}</SelectContent></Select>}<div className="flex gap-2"><Button variant="outline" disabled={stageIndex <= 0} onClick={() => moveStage.mutate(-1)}><ArrowLeft className="h-4 w-4" />Retroceder</Button><Button disabled={stageIndex >= stages.length - 1} onClick={() => moveStage.mutate(1)}>Avanzar<ArrowRight className="h-4 w-4" /></Button></div><Card className="p-4 bg-card/40"><h4 className="mb-3 font-medium">Días por etapa</h4><div className="space-y-2">{(prospect.stage_history ?? []).map((h: any) => <div key={h.id} className="flex justify-between text-sm"><span>{h.stage?.name}</span><span>{daysBetween(h.entered_at, h.exited_at ? new Date(h.exited_at) : new Date())} días</span></div>)}</div></Card></TabsContent><TabsContent value="alerts" className="space-y-4"><Card className={cn("p-4", inactiveDays >= (settings?.inactivity_threshold_days ?? 7) ? "border-destructive bg-destructive/5" : "bg-card/40")}><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{inactiveDays} días desde el último contacto · umbral {(settings?.inactivity_threshold_days ?? 7)} días</div></Card><Card className="p-4 bg-card/40"><div className="grid grid-cols-2 gap-3"><Input placeholder="Título" value={alert.title} onChange={(e) => setAlert({ ...alert, title: e.target.value })} /><Select value={alert.alert_type} onValueChange={(v) => setAlert({ ...alert, alert_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed_date">Fecha fija</SelectItem><SelectItem value="relative_days">En X días</SelectItem></SelectContent></Select>{alert.alert_type === "fixed_date" ? <Input type="date" value={alert.alert_date} onChange={(e) => setAlert({ ...alert, alert_date: e.target.value })} /> : <Input type="number" min={1} value={alert.relative_days} onChange={(e) => setAlert({ ...alert, relative_days: e.target.value })} />}<Input placeholder="emails separados por coma" value={alert.notify_emails} onChange={(e) => setAlert({ ...alert, notify_emails: e.target.value })} /><Textarea className="col-span-2" placeholder="Descripción" value={alert.description} onChange={(e) => setAlert({ ...alert, description: e.target.value })} /><Button onClick={() => addAlert.mutate()} disabled={!alert.title}>Crear alerta</Button></div></Card><div className="space-y-2">{(prospect.alerts ?? []).map((a: any) => <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-card/40 p-3"><div><div className="font-medium">{a.title}</div><div className="text-xs text-muted-foreground">{fmtDate(a.alert_date)} · {a.alert_type}</div></div>{!a.is_dismissed && <Button variant="outline" size="sm" onClick={() => dismissAlert.mutate(a.id)}><X className="h-4 w-4" />Descartar</Button>}</div>)}</div></TabsContent></Tabs><ConversionModal open={convertOpen} onOpenChange={setConvertOpen} prospect={prospect} stages={stages} /></DialogContent></Dialog>;
}

function Info({ label, value }: { label: string; value?: any }) { return <div className="rounded-md border border-border bg-card/40 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value || "—"}</div></div>; }

function ConversionModal({ open, onOpenChange, prospect, stages }: any) {
  const qc = useQueryClient();
  const wonStage = stages.find((s: any) => s.name === "Cerrado Ganado");
  const convert = useMutation({ mutationFn: async () => { const { data, error } = await (supabase as any).from("clients").insert({ company_name: prospect.business_name, country_id: prospect.country_id, province_id: null, city_id: null, assigned_executive_id: prospect.assigned_executive_id, billing_frequency: "monthly", status: "pending_setup", monthly_fee: 0, fee_currency: prospect.currency, cmv_cost: 0, cmv_currency: prospect.currency, branches_count: 1, contact_name: prospect.contact_name, contact_phone: prospect.phone, contact_email: prospect.email, reports_email: prospect.email, notes: `Convertido desde prospecto. ${prospect.notes ?? ""}` }).select().single(); if (error) throw error; const platformRows = (prospect.platforms ?? []).map((p: any) => ({ client_id: data.id, platform_id: p.platform_id, commission_rate: 0 })); if (platformRows.length) await (supabase as any).from("client_platforms").insert(platformRows); await (supabase as any).from("prospects").update({ converted_to_client_id: data.id, status: "converted", current_stage_id: wonStage?.id ?? prospect.current_stage_id, stage_entered_at: new Date().toISOString() }).eq("id", prospect.id); }, onSuccess: () => { toast.success("Prospecto convertido a cliente. Completar campos pendientes en Clientes."); qc.invalidateQueries({ queryKey: ["prospects"] }); qc.invalidateQueries({ queryKey: ["clients"] }); onOpenChange(false); }, onError: (e: any) => toast.error(e.message) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Convertir a cliente</DialogTitle></DialogHeader><div className="space-y-3 text-sm"><p>Se creará el cliente <strong>{prospect?.business_name}</strong> con país, ejecutivo y plataformas preseleccionadas.</p><div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-warning">Quedarán pendientes: frecuencia final de facturación, comisión por plataforma, CMV, comisión ejecutiva y tipo de factura.</div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => convert.mutate()} disabled={convert.isPending}>Confirmar conversión</Button></DialogFooter></DialogContent></Dialog>;
}

function ProspectingDashboard({ prospects, stages, countries, employees }: any) {
  const active = prospects.filter((p: any) => p.status === "active");
  const closed = prospects.filter((p: any) => ["converted", "lost"].includes(p.status));
  const won = prospects.filter((p: any) => p.status === "converted");
  const value = active.reduce((acc: any, p: any) => ({ ...acc, [p.currency]: (acc[p.currency] ?? 0) + Number(p.estimated_monthly_revenue || 0) }), {});
  const byStage = stages.map((s: any) => ({ name: s.name, count: prospects.filter((p: any) => p.current_stage_id === s.id).length, value: prospects.filter((p: any) => p.current_stage_id === s.id).reduce((a: number, p: any) => a + Number(p.estimated_monthly_revenue || 0), 0) }));
  const byExec = employees.map((e: any) => ({ name: e.full_name, asignados: prospects.filter((p: any) => p.assigned_executive_id === e.id).length, ganados: won.filter((p: any) => p.assigned_executive_id === e.id).length }));
  const byCountry = countries.map((c: any) => ({ name: c.name, prospects: prospects.filter((p: any) => p.country_id === c.id).length, value: prospects.filter((p: any) => p.country_id === c.id).reduce((a: number, p: any) => a + Number(p.estimated_monthly_revenue || 0), 0) }));
  const lostReasons = Object.values(prospects.filter((p: any) => p.lost_reason?.reason).reduce((acc: any, p: any) => { acc[p.lost_reason.reason] = acc[p.lost_reason.reason] ?? { name: p.lost_reason.reason, count: 0 }; acc[p.lost_reason.reason].count++; return acc; }, {}));
  const alerts = prospects.flatMap((p: any) => (p.alerts ?? []).filter((a: any) => !a.is_dismissed).map((a: any) => ({ ...a, prospect: p }))).sort((a: any, b: any) => +new Date(a.alert_date) - +new Date(b.alert_date));
  return <div className="space-y-4"><div className="grid grid-cols-5 gap-4"><Metric title="Activos" value={active.length} /><Metric title="Pipeline ARS" value={formatMoney(value.ARS ?? 0, "ARS")} /><Metric title="Pipeline EUR" value={formatMoney(value.EUR ?? 0, "EUR")} /><Metric title="Alertas" value={alerts.length} /><Metric title="Conversión" value={`${closed.length ? Math.round((won.length / closed.length) * 100) : 0}%`} /></div><div className="grid grid-cols-2 gap-4"><ChartCard title="Funnel"><BarChart data={byStage}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" /></BarChart></ChartCard><ChartCard title="Valor por etapa"><BarChart data={byStage}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="hsl(var(--accent-foreground))" /></BarChart></ChartCard><ChartCard title="Conversión por ejecutivo"><BarChart data={byExec}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="asignados" fill="hsl(var(--muted-foreground))" /><Bar dataKey="ganados" fill="hsl(var(--primary))" /></BarChart></ChartCard><ChartCard title="Prospectos por país"><PieChart><Pie data={byCountry} dataKey="prospects" nameKey="name" outerRadius={90}>{byCountry.map((_: any, i: number) => <Cell key={i} fill={["hsl(var(--primary))", "hsl(var(--secondary-foreground))", "hsl(var(--muted-foreground))"][i % 3]} />)}</Pie><Tooltip /></PieChart></ChartCard><ChartCard title="Motivos de pérdida"><BarChart data={lostReasons}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="count" fill="hsl(var(--destructive))" /></BarChart></ChartCard><ChartCard title="Tendencia mensual"><LineChart data={monthlyTrend(prospects)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line dataKey="nuevos" stroke="hsl(var(--primary))" /><Line dataKey="ganados" stroke="hsl(var(--success))" /></LineChart></ChartCard></div><Card className="p-4 bg-gradient-card border-border/60"><h3 className="font-medium mb-3">Alertas por urgencia</h3><div className="space-y-2">{alerts.slice(0, 10).map((a: any) => <div key={a.id} className="flex justify-between rounded-md border border-border bg-card/40 p-3"><span>{a.prospect.business_name} · {a.title}</span><span className={cn("text-sm", new Date(a.alert_date) < new Date() ? "text-destructive" : "text-muted-foreground")}>{fmtDate(a.alert_date)}</span></div>)}</div></Card></div>;
}

function monthlyTrend(prospects: any[]) { const map: any = {}; prospects.forEach((p) => { const m = String(p.created_at).slice(0, 7); map[m] = map[m] ?? { month: m, nuevos: 0, ganados: 0 }; map[m].nuevos++; if (p.status === "converted") map[m].ganados++; }); return Object.values(map).sort((a: any, b: any) => a.month.localeCompare(b.month)); }
function Metric({ title, value }: any) { return <Card className="p-4 bg-gradient-card border-border/60"><div className="text-xs text-muted-foreground uppercase tracking-wide">{title}</div><div className="mt-2 text-2xl font-semibold">{value}</div></Card>; }
function ChartCard({ title, children }: any) { return <Card className="p-4 bg-gradient-card border-border/60"><h3 className="mb-3 font-medium">{title}</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></Card>; }
