import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useCountries, usePlatforms } from "@/hooks/useCatalogs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Client = any;

const STATUS_LABEL: Record<string, string> = { active: "Activo", inactive: "Inactivo", suspended: "Suspendido" };
const FREQ_LABEL: Record<string, string> = { weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual" };

export default function Clients() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, country:countries(*), executive:employees(id, full_name), client_platforms(*, platform:platforms(*)), client_executive_commission(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente eliminado"); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = clients.filter((c: any) => c.company_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageContainer>
      <PageHeader
        title="Clientes"
        description="Gestión de cuentas, plataformas y comisiones"
        actions={isAdmin && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo cliente
          </Button>
        )}
      />

      <Card className="p-4 mb-4 bg-gradient-card border-border/60">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin clientes" description="Comenzá creando tu primer cliente" action={isAdmin && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nuevo cliente</Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Plataformas</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Ejecutivo</TableHead>
                <TableHead>Estado</TableHead>
                {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>{c.country?.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.client_platforms?.map((cp: any) => (
                        <Badge key={cp.id} variant="secondary" className="text-[10px]">{cp.platform?.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{FREQ_LABEL[c.billing_frequency]}</TableCell>
                  <TableCell className="text-muted-foreground">{c.executive?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : c.status === "suspended" ? "destructive" : "secondary"}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción eliminará al cliente y todas sus facturas asociadas.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del.mutate(c.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ClientDialog open={open} onOpenChange={setOpen} client={editing} />
    </PageContainer>
  );
}

function ClientDialog({ open, onOpenChange, client }: { open: boolean; onOpenChange: (v: boolean) => void; client: Client | null }) {
  const qc = useQueryClient();
  const { data: countries = [] } = useCountries();
  const { data: platforms = [] } = usePlatforms();
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, { commission_rate: number; cmv_cost: number; selected: boolean }>>({});
  const [commissions, setCommissions] = useState<Record<string, number>>({});

  // Initialize form when dialog opens or client changes
  useEffect(() => {
    if (!open) return;
    if (client) {
      setForm({
        company_name: client.company_name,
        country_id: client.country_id,
        billing_frequency: client.billing_frequency,
        status: client.status,
        assigned_executive_id: client.assigned_executive_id ?? null,
      });
      const sp: any = {};
      client.client_platforms?.forEach((cp: any) => { sp[cp.platform_id] = { commission_rate: cp.commission_rate, cmv_cost: cp.cmv_cost, selected: true }; });
      setSelectedPlatforms(sp);
      const cm: any = {};
      client.client_executive_commission?.forEach((c: any) => { cm[c.employee_id] = c.commission_value; });
      setCommissions(cm);
    } else {
      setForm({ company_name: "", country_id: countries[0]?.id ?? "", billing_frequency: "monthly", status: "active", assigned_executive_id: null });
      setSelectedPlatforms({});
      setCommissions({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id, countries.length]);

  const save = useMutation({
    mutationFn: async () => {
      let clientId = client?.id;
      if (clientId) {
        const { error } = await supabase.from("clients").update(form).eq("id", clientId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("clients").insert(form).select().single();
        if (error) throw error;
        clientId = data.id;
      }
      // Replace platforms
      await supabase.from("client_platforms").delete().eq("client_id", clientId);
      const platformRows = Object.entries(selectedPlatforms)
        .filter(([_, v]) => v.selected)
        .map(([platform_id, v]) => ({ client_id: clientId, platform_id, commission_rate: v.commission_rate, cmv_cost: v.cmv_cost }));
      if (platformRows.length) await supabase.from("client_platforms").insert(platformRows);
      // Replace commissions
      await supabase.from("client_executive_commission").delete().eq("client_id", clientId);
      const country = countries.find((c: any) => c.id === form.country_id);
      const commRows = Object.entries(commissions)
        .filter(([_, v]) => Number(v) > 0)
        .map(([employee_id, v]) => ({ client_id: clientId, employee_id, commission_value: Number(v), currency: country?.currency_code ?? "ARS" }));
      if (commRows.length) await supabase.from("client_executive_commission").insert(commRows);
    },
    onSuccess: () => {
      toast.success(client ? "Cliente actualizado" : "Cliente creado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
      setForm({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Empresa</Label>
              <Input value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div>
              <Label>País</Label>
              <Select value={form.country_id ?? ""} onValueChange={(v) => setForm({ ...form, country_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.currency_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frecuencia de cobro</Label>
              <Select value={form.billing_frequency ?? "monthly"} onValueChange={(v) => setForm({ ...form, billing_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Ejecutivo asignado</Label>
              <Select value={form.assigned_executive_id ?? "none"} onValueChange={(v) => setForm({ ...form, assigned_executive_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Plataformas activas</Label>
            <div className="space-y-2 border border-border rounded-md p-3 bg-card/40">
              {platforms.map((p: any) => {
                const sel = selectedPlatforms[p.id];
                return (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-4 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!sel?.selected} onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, [p.id]: { commission_rate: sel?.commission_rate ?? 0, cmv_cost: sel?.cmv_cost ?? 0, selected: e.target.checked } })} />
                      {p.name}
                    </label>
                    <div className="col-span-4">
                      <Input type="number" step="0.01" placeholder="Comisión %" disabled={!sel?.selected} value={sel?.commission_rate ?? ""} onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, [p.id]: { ...sel, selected: true, commission_rate: Number(e.target.value), cmv_cost: sel?.cmv_cost ?? 0 } })} />
                    </div>
                    <div className="col-span-4">
                      <Input type="number" step="0.01" placeholder="CMV costo" disabled={!sel?.selected} value={sel?.cmv_cost ?? ""} onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, [p.id]: { ...sel, selected: true, cmv_cost: Number(e.target.value), commission_rate: sel?.commission_rate ?? 0 } })} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Comisiones de ejecutivos por este cliente</Label>
            <div className="space-y-2 border border-border rounded-md p-3 bg-card/40">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay empleados creados aún.</p>
              ) : employees.map((e: any) => (
                <div key={e.id} className="grid grid-cols-2 gap-2 items-center">
                  <span className="text-sm">{e.full_name}</span>
                  <Input type="number" step="0.01" placeholder="Comisión" value={commissions[e.id] ?? ""} onChange={(ev) => setCommissions({ ...commissions, [e.id]: Number(ev.target.value) })} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.company_name || !form.country_id}>
            {save.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
