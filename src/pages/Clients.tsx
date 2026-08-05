import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// `country-state-city` ships a multi-MB JSON catalogue and only the
// "create new country" dialog branch actually uses it. Importing it eagerly at
// the top of this module forced every visit to /clientes to parse the entire
// dataset, which on lower-end mobile devices blew the JS engine call stack
// (surfacing as "Maximum call stack size exceeded" on the Clients view).
// We now lazy-load it on demand inside `ClientDialog` only when the user opts
// into the "create a new country" flow.
type CountryStateCityModule = typeof import("country-state-city");
import { PageContainer, PageHeader, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, X, AlertCircle, Download } from "lucide-react";
import { useCountries, usePlatforms, useProvinces, useCities, useFoodCategories, usePaymentMethods } from "@/hooks/useCatalogs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney, fmtDate } from "@/lib/format";
import { useCountryFilter } from "@/hooks/useCountryFilter";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";
import { PAYMENT_CHANNEL_OPTIONS, PAYMENT_CHANNEL_LABEL, DISCOUNT_DURATION_OPTIONS, addDaysISO } from "@/lib/billing";
import { PriceHistoryTimeline } from "@/components/PriceHistoryTimeline";
import { Checkbox } from "@/components/ui/checkbox";

type Client = any;

const STATUS_LABEL: Record<string, string> = { onboarding: "Onboarding", active: "Activo", paused: "Suspendido", churned: "Inactivo" };
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Activo" },
  { value: "paused", label: "Suspendido" },
  { value: "churned", label: "Inactivo" },
];
const FREQ_LABEL: Record<string, string> = { weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual" };
const BILLING_FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
];

export default function Clients() {
  const qc = useQueryClient();
  const { isAdmin, canEditAdminFinance } = useAuth();
  const { countryId } = useCountryFilter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterBillingUser, setFilterBillingUser] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkUserId, setBulkUserId] = useState<string>("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-billing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", countryId],
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("*, country:countries(*), province:provinces(id,name), city:cities(id,name), food_category:food_categories(id,name), payment_method:payment_methods(id,name), executive:employees(id, full_name), client_platforms(*, platform:platforms(*)), client_executive_commission(*), client_sub_brands(*, country:countries(*), province:provinces(id,name), city:cities(id,name), food_category:food_categories(id,name))")
        .order("created_at", { ascending: false });
      if (countryId) q = q.eq("country_id", countryId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const profileName = (id?: string | null) => profiles.find((p: any) => p.id === id)?.full_name ?? profiles.find((p: any) => p.id === id)?.email ?? "—";

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente eliminado"); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkAssign = useMutation({
    mutationFn: async () => {
      if (!bulkUserId || selected.size === 0) return;
      const { error } = await supabase
        .from("clients")
        .update({ billing_user_id: bulkUserId === "__none__" ? null : bulkUserId })
        .in("id", [...selected]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsables actualizados");
      setSelected(new Set());
      setBulkUserId("");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openClientDialog = (client: Client | null) => {
    setEditing(client);
    setOpen(true);
  };

  const toggleSelected = (id: string, checked: boolean | "indeterminate") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked === true) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return clients.filter((c: any) => {
      const name = (c?.company_name ?? "").toString().toLowerCase();
      if (normalizedSearch && !name.includes(normalizedSearch)) return false;
      if (filterChannel !== "all" && c.payment_channel !== filterChannel) return false;
      if (filterBillingUser !== "all") {
        if (filterBillingUser === "__none__" ? c.billing_user_id : c.billing_user_id !== filterBillingUser) return false;
      }
      return true;
    });
  }, [clients, search, filterChannel, filterBillingUser]);

  const incompleteCount = useMemo(
    () => clients.filter((c: any) => !c.payment_channel || !c.billing_user_id).length,
    [clients],
  );

  const billingMultiplier = (frequency?: string | null) => frequency === "weekly" ? 4 : frequency === "biweekly" ? 2 : 1;
  const normalizedClientFee = (c: any) => {
    const branches = c.fee_billing_mode === "flat" ? 1 : Math.max(1, Number(c.branches_count || 1));
    return Number(c.monthly_fee || 0) * branches * billingMultiplier(c.billing_frequency);
  };
  const sumByCurrency = (rows: any[]) => {
    const map: Record<string, number> = {};
    rows.forEach((c) => {
      const cur = c.fee_currency ?? "—";
      map[cur] = (map[cur] ?? 0) + normalizedClientFee(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  };
  const activeFiltered = useMemo(() => filtered.filter((c: any) => c.status === "active"), [filtered]);
  const totalsFiltered = useMemo(() => sumByCurrency(activeFiltered), [activeFiltered]);
  const selectedClients = useMemo(() => filtered.filter((c: any) => selected.has(c.id)), [filtered, selected]);
  const totalsSelected = useMemo(() => sumByCurrency(selectedClients), [selectedClients]);

  const confirmDelete = () => {
    if (!clientToDelete) return;
    const id = clientToDelete.id;
    setClientToDelete(null);
    del.mutate(id);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageContainer>
      <PageHeader
        title="Clientes"
        description="Gestión de cuentas, plataformas y comisiones"
        actions={canEditAdminFinance && (
          <Button onClick={() => openClientDialog(null)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo cliente
          </Button>
        )}
      />

      {canEditAdminFinance && incompleteCount > 0 && (
        <Card className="p-3 mb-4 border-warning/40 bg-warning/10 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-warning" />
          <span><strong>{incompleteCount}</strong> cliente(s) sin método o responsable de cobro asignado.</span>
        </Card>
      )}

      <Card className="p-4 mb-4 bg-gradient-card border-border/60 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <CountryFilterSelect className="w-[200px]" />
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Quién cobra" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {PAYMENT_CHANNEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterBillingUser} onValueChange={setFilterBillingUser}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Responsable de facturar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los responsables</SelectItem>
            <SelectItem value="__none__">Sin asignar</SelectItem>
            {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4 mb-4 bg-gradient-card border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Facturación mensual (solo activos) {countryId ? "del país filtrado" : "· todos los países"} · {activeFiltered.length} de {filtered.length} cliente(s)</div>
            <div className="flex flex-wrap gap-3 mt-1">
              {totalsFiltered.length ? totalsFiltered.map(([cur, total]) => (
                <span key={cur} className="font-mono text-base font-semibold">{formatMoney(total, cur)}</span>
              )) : <span className="text-sm text-muted-foreground">Sin datos</span>}
            </div>
          </div>
          {selected.size > 0 && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Seleccionados · {selected.size}</div>
              <div className="flex flex-wrap gap-3 justify-end mt-1">
                {totalsSelected.map(([cur, total]) => (
                  <span key={cur} className="font-mono text-base font-semibold text-primary">{formatMoney(total, cur)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {canEditAdminFinance && selected.size > 0 && (
        <Card className="p-3 mb-3 bg-primary/5 border-primary/30 flex flex-wrap items-center gap-3">
          <span className="text-sm">{selected.size} seleccionado(s)</span>
          <Select value={bulkUserId} onValueChange={setBulkUserId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Reasignar responsable…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin asignar</SelectItem>
              {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!bulkUserId || bulkAssign.isPending} onClick={() => bulkAssign.mutate()}>Aplicar</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancelar</Button>
        </Card>
      )}

      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin clientes" description="Comenzá creando tu primer cliente" action={canEditAdminFinance && <Button onClick={() => openClientDialog(null)}><Plus className="h-4 w-4 mr-2" />Nuevo cliente</Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {canEditAdminFinance && <TableHead className="w-8"></TableHead>}
                <TableHead>Empresa</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Sub-marcas</TableHead>
                <TableHead>Sucursales</TableHead>
                <TableHead>Fee cobro</TableHead>
                <TableHead>Quién cobra</TableHead>
                <TableHead>Tipo factura</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Responsable</TableHead>

                <TableHead>Descuento</TableHead>
                <TableHead>Plataformas</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Ejecutivo</TableHead>
                <TableHead>Estado</TableHead>
                {canEditAdminFinance && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => {
                const discountVigent = c.discount_active && c.discount_percentage && (!c.discount_ends_at || c.discount_ends_at >= today);
                const discountExpired = c.discount_percentage && c.discount_ends_at && c.discount_ends_at < today;
                return (
                <TableRow key={c.id}>
                  {canEditAdminFinance && (
                    <TableCell>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggleSelected(c.id, v)} />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>{c.country?.name}</TableCell>
                  <TableCell>{c.client_sub_brands?.length ?? 0}</TableCell>
                  <TableCell>{c.branches_count}</TableCell>
                  <TableCell className="font-mono">{formatMoney(c.monthly_fee, c.fee_currency)}</TableCell>
                  <TableCell>
                    {c.payment_channel
                      ? <Badge variant="outline">{PAYMENT_CHANNEL_LABEL[c.payment_channel]}</Badge>
                      : <Badge variant="secondary" className="text-[10px]">sin asignar</Badge>}
                  </TableCell>
                  <TableCell>
                    {c.invoice_letter
                      ? <Badge variant="outline">{c.invoice_letter}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">Vencimiento de factura: {c.payment_term_days ?? 5} días</TableCell>
                  <TableCell className="text-sm">{c.billing_user_id ? profileName(c.billing_user_id) : <Badge variant="secondary" className="text-[10px]">sin asignar</Badge>}</TableCell>

                  <TableCell>
                    {discountVigent ? (
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[10px]">{c.discount_percentage}% · vence {c.discount_ends_at ? fmtDate(c.discount_ends_at) : "—"}</Badge>
                    ) : discountExpired ? (
                      <Badge variant="destructive" className="text-[10px]">vencido {fmtDate(c.discount_ends_at)}</Badge>
                    ) : "—"}
                  </TableCell>
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
                    <Badge variant={c.status === "active" ? "default" : c.status === "paused" ? "destructive" : "secondary"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  {canEditAdminFinance && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openClientDialog(c)}><Pencil className="h-4 w-4" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" onClick={() => setClientToDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ClientDialog open={open} onOpenChange={setOpen} client={editing} profiles={profiles} />
      <AlertDialog open={!!clientToDelete} onOpenChange={(next) => !next && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {clientToDelete?.company_name
                ? `Esta acción eliminará a ${clientToDelete.company_name} y todas sus facturas asociadas.`
                : "Esta acción eliminará al cliente y todas sus facturas asociadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function ClientDialog({ open, onOpenChange, client, profiles = [] }: { open: boolean; onOpenChange: (v: boolean) => void; client: Client | null; profiles?: any[] }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: countries = [] } = useCountries();
  const { data: platforms = [] } = usePlatforms();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: foodCategories = [] } = useFoodCategories();
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, { commission_rate: number; selected: boolean }>>({});
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const [newCountry, setNewCountry] = useState<{ name: string; isoCode: string; currency_code: string; currency_symbol: string } | null>(null);
  const [newCountryProvince, setNewCountryProvince] = useState("");
  const [newCountryCity, setNewCountryCity] = useState("");
  const [newFoodCategory, setNewFoodCategory] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [subBrands, setSubBrands] = useState<any[]>([]);

  const { data: provinces = [] } = useProvinces(form.country_id);
  const { data: cities = [] } = useCities(form.province_id);

  const currentCountry = countries.find((c: any) => c.id === form.country_id);
  const defaultCurrency = currentCountry?.currency_code ?? newCountry?.currency_code ?? "ARS";
  // Lazy-load the heavy `country-state-city` catalogue only when the
  // "create new country" branch is actually opened.
  const [csc, setCsc] = useState<CountryStateCityModule | null>(null);
  useEffect(() => {
    if (!newCountry || csc) return;
    let cancelled = false;
    import("country-state-city").then((mod) => {
      if (!cancelled) setCsc(mod);
    });
    return () => { cancelled = true; };
  }, [newCountry, csc]);

  const availableCountries = useMemo(() => csc?.Country.getAllCountries() ?? [], [csc]);
  const availableStates = useMemo(
    () => (csc && newCountry?.isoCode ? csc.State.getStatesOfCountry(newCountry.isoCode) : []),
    [csc, newCountry?.isoCode],
  );
  const availableCities = useMemo(
    () => (csc && newCountry?.isoCode && newCountryProvince
      ? csc.City.getCitiesOfState(newCountry.isoCode, newCountryProvince)
      : []),
    [csc, newCountry?.isoCode, newCountryProvince],
  );

  const addSubBrand = () => {
    setSubBrands([
      ...subBrands,
      {
        name: "",
        country_id: form.country_id,
        province_id: null,
        city_id: null,
        address: "",
        billing_frequency: form.billing_frequency ?? "monthly",
        status: "active",
        monthly_fee: 0,
        fee_currency: defaultCurrency,
        cmv_cost: 0,
        cmv_currency: defaultCurrency,
        branches_count: 1,
        fee_billing_mode: form.fee_billing_mode ?? "per_branch",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        reports_email: "",
        food_category_id: form.food_category_id ?? null,
        notes: "",
      },
    ]);
  };

  const updateSubBrand = (index: number, patch: Record<string, any>) => {
    setSubBrands(subBrands.map((brand, i) => (i === index ? { ...brand, ...patch } : brand)));
  };

  const removeSubBrand = (index: number) => {
    setSubBrands(subBrands.filter((_, i) => i !== index));
  };

  // Initialize form when dialog opens or client changes
  useEffect(() => {
    if (!open) return;
    if (client) {
      setForm({
        company_name: client.company_name,
        legal_name: (client as any).legal_name ?? "",
        tax_id: (client as any).tax_id ?? "",
        country_id: client.country_id,
        province_id: client.province_id,
        city_id: client.city_id,
        address: client.address ?? "",
        billing_frequency: client.billing_frequency,
        payment_method_id: client.payment_method_id ?? null,
        status: client.status,
        assigned_executive_id: client.assigned_executive_id ?? null,
        monthly_fee: client.monthly_fee ?? 0,
        fee_currency: client.fee_currency ?? "ARS",
        cmv_cost: client.cmv_cost ?? 0,
        cmv_currency: client.cmv_currency ?? "ARS",
        branches_count: client.branches_count ?? 1,
        fee_billing_mode: (client as any).fee_billing_mode ?? "per_branch",
        contact_name: client.contact_name ?? "",
        contact_phone: client.contact_phone ?? "",
        contact_email: client.contact_email ?? "",
        reports_email: client.reports_email ?? "",
        food_category_id: client.food_category_id ?? null,
        notes: client.notes ?? "",
        payment_channel: client.payment_channel ?? null,
        billing_user_id: client.billing_user_id ?? null,
        payment_term_days: (client as any).payment_term_days ?? 5,
        invoice_letter: (client as any).invoice_letter ?? null,

        discount_percentage: client.discount_percentage ?? null,
        discount_duration: client.discount_duration ?? null,
        discount_starts_at: client.discount_starts_at ?? null,
        discount_ends_at: client.discount_ends_at ?? null,
        discount_active: client.discount_active ?? false,
        activated_at: client.activated_at ?? null,
        paused_at: client.paused_at ?? null,
        churned_at: client.churned_at ?? null,
      });
      setSubBrands(client.client_sub_brands ?? []);
      const sp: any = {};
      client.client_platforms?.forEach((cp: any) => { sp[cp.platform_id] = { commission_rate: cp.commission_rate, selected: true }; });
      setSelectedPlatforms(sp);
      const cm: any = {};
      client.client_executive_commission?.forEach((c: any) => { cm[c.employee_id] = c.commission_value; });
      setCommissions(cm);
    } else {
      const defCountry = countries[0];
      setForm({
        company_name: "",
        legal_name: "",
        tax_id: "",
        country_id: defCountry?.id ?? "",
        province_id: null,
        city_id: null,
        address: "",
        billing_frequency: "monthly",
        payment_method_id: paymentMethods.find((method: any) => method.name === "Depósito Bancario")?.id ?? paymentMethods[0]?.id ?? null,
        status: "active",
        assigned_executive_id: null,
        monthly_fee: 0,
        fee_currency: defCountry?.currency_code ?? "ARS",
        cmv_cost: 0,
        cmv_currency: defCountry?.currency_code ?? "ARS",
        branches_count: 1,
        fee_billing_mode: "per_branch",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        reports_email: "",
        food_category_id: null,
        notes: "",
        payment_channel: null,
        billing_user_id: null,
        payment_term_days: 5,
        invoice_letter: null,

        discount_percentage: null,
        discount_duration: null,
        discount_starts_at: null,
        discount_ends_at: null,
        discount_active: false,
        activated_at: null,
        paused_at: null,
        churned_at: null,
      });
      setSelectedPlatforms({});
      setCommissions({});
      setSubBrands([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  const save = useMutation({
    mutationFn: async () => {
      let countryId = form.country_id;

      // If user is creating a brand-new country, insert it first
      if (!countryId && newCountry) {
        const name = newCountry.name.trim();
        const code = newCountry.currency_code.trim().toUpperCase();
        const symbol = newCountry.currency_symbol.trim();
        if (!name || !code || !symbol) throw new Error("Completá nombre, código de moneda y símbolo del país");
        if (code.length > 5) throw new Error("Código de moneda inválido (máx 5 caracteres)");
        const { data, error } = await supabase
          .from("countries")
          .insert({ name, currency_code: code, currency_symbol: symbol })
          .select()
          .single();
        if (error) throw error;
        countryId = data.id;

        let provinceId: string | null = null;
        if (newCountryProvince) {
          const provinceName = availableStates.find((s) => s.isoCode === newCountryProvince)?.name ?? newCountryProvince;
          const { data: province, error: provinceError } = await supabase.from("provinces").insert({ country_id: countryId, name: provinceName }).select().single();
          if (provinceError) throw provinceError;
          provinceId = province.id;
          form.province_id = provinceId;
        }
        if (provinceId && newCountryCity) {
          const cityName = availableCities.find((c) => c.name === newCountryCity)?.name ?? newCountryCity;
          const { data: city, error: cityError } = await supabase.from("cities").insert({ province_id: provinceId, name: cityName }).select().single();
          if (cityError) throw cityError;
          form.city_id = city.id;
        }
      }

      if (!countryId) throw new Error("Seleccioná un país");

      let foodCategoryId = form.food_category_id || null;
      if (foodCategoryId === "__new__") {
        const name = newFoodCategory.trim();
        if (!name) throw new Error("Completá la nueva categoría gastronómica");
        const { data, error } = await (supabase as any).from("food_categories").insert({ name }).select().single();
        if (error) throw error;
        foodCategoryId = data.id;
      }

      let paymentMethodId = form.payment_method_id || null;
      if (paymentMethodId === "__new__") {
        const name = newPaymentMethod.trim();
        if (!name) throw new Error("Completá la nueva forma de pago");
        const { data, error } = await (supabase as any).from("payment_methods").insert({ name }).select().single();
        if (error) throw error;
        paymentMethodId = data.id;
      }

      const payload = {
        company_name: form.company_name,
        legal_name: form.legal_name || null,
        tax_id: form.tax_id || null,
        country_id: countryId,
        province_id: form.province_id || null,
        city_id: form.city_id || null,
        address: form.address || null,
        billing_frequency: form.billing_frequency,
        payment_method_id: paymentMethodId,
        status: form.status,
        assigned_executive_id: form.assigned_executive_id,
        monthly_fee: Number(form.monthly_fee) || 0,
        fee_currency: form.fee_currency,
        cmv_cost: Number(form.cmv_cost) || 0,
        cmv_currency: form.cmv_currency,
        branches_count: Number(form.branches_count) || 1,
        fee_billing_mode: form.fee_billing_mode === "flat" ? "flat" : "per_branch",
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        reports_email: form.reports_email || null,
        food_category_id: foodCategoryId,
        notes: form.notes || null,
        payment_channel: form.payment_channel || null,
        billing_user_id: form.billing_user_id || null,
        payment_term_days: form.payment_term_days === "" || form.payment_term_days == null ? 5 : Math.max(0, Number(form.payment_term_days) || 0),
        invoice_letter: form.invoice_letter || null,

        discount_percentage: form.discount_percentage != null && form.discount_percentage !== "" ? Number(form.discount_percentage) : null,
        discount_duration: form.discount_duration || null,
        discount_starts_at: form.discount_starts_at || null,
        discount_ends_at: form.discount_ends_at || null,
        discount_active: !!form.discount_active && !!form.discount_percentage,
        ...(isAdmin ? { activated_at: form.activated_at || null } : {}),
      };

      let clientId = client?.id;
      if (clientId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", clientId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("clients").insert(payload).select().single();
        if (error) throw error;
        clientId = data.id;
      }
      // Replace platforms
      await supabase.from("client_platforms").delete().eq("client_id", clientId);
      const platformRows = Object.entries(selectedPlatforms)
        .filter(([_, v]) => v.selected)
        .map(([platform_id, v]) => ({ client_id: clientId!, platform_id, commission_rate: v.commission_rate }));
      if (platformRows.length) await supabase.from("client_platforms").insert(platformRows);
      // Replace commissions
      await supabase.from("client_executive_commission").delete().eq("client_id", clientId);
      const commRows = Object.entries(commissions)
        .filter(([_, v]) => Number(v) > 0)
        .map(([employee_id, v]) => ({ client_id: clientId!, employee_id, commission_value: Number(v), currency: defaultCurrency }));
      if (commRows.length) await supabase.from("client_executive_commission").insert(commRows);

      await (supabase as any).from("client_sub_brands").delete().eq("client_id", clientId);
      const subBrandRows = subBrands
        .filter((brand) => brand.name?.trim())
        .map((brand) => ({
          client_id: clientId!,
          name: brand.name.trim(),
          country_id: brand.country_id || countryId,
          province_id: brand.province_id || null,
          city_id: brand.city_id || null,
          address: brand.address || null,
          billing_frequency: brand.billing_frequency || "monthly",
          status: brand.status || "active",
          monthly_fee: Number(brand.monthly_fee) || 0,
          fee_currency: brand.fee_currency || defaultCurrency,
          cmv_cost: Number(brand.cmv_cost) || 0,
          cmv_currency: brand.cmv_currency || defaultCurrency,
          branches_count: Number(brand.branches_count) || 1,
          fee_billing_mode: brand.fee_billing_mode === "flat" ? "flat" : "per_branch",
          contact_name: brand.contact_name || null,
          contact_phone: brand.contact_phone || null,
          contact_email: brand.contact_email || null,
          reports_email: brand.reports_email || null,
          food_category_id: brand.food_category_id === "__new__" ? foodCategoryId : brand.food_category_id || null,
          notes: brand.notes || null,
        }));
      if (subBrandRows.length) await (supabase as any).from("client_sub_brands").insert(subBrandRows);
    },
    onSuccess: () => {
      toast.success(client ? "Cliente actualizado" : "Cliente creado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["countries"] });
      qc.invalidateQueries({ queryKey: ["food_categories"] });
      qc.invalidateQueries({ queryKey: ["payment_methods"] });
      onOpenChange(false);
      setForm({});
      setNewCountry(null);
      setNewCountryProvince("");
      setNewCountryCity("");
      setNewFoodCategory("");
      setNewPaymentMethod("");
      setSubBrands([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm({}); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Datos generales */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Datos generales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Empresa *</Label>
                <Input value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div>
                <Label>Razón social</Label>
                <Input value={form.legal_name ?? ""} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
              </div>
              <div>
                <Label>CUIT</Label>
                <Input value={form.tax_id ?? ""} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="20-12345678-9" />
              </div>
              <div>
                <Label>País *</Label>
                <Select
                  value={newCountry ? "__new__" : (form.country_id ?? "")}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      setNewCountry({ name: "", isoCode: "", currency_code: "", currency_symbol: "" });
                      setNewCountryProvince("");
                      setNewCountryCity("");
                      setForm({ ...form, country_id: "", province_id: null, city_id: null });
                      return;
                    }
                    setNewCountry(null);
                    const c = countries.find((x: any) => x.id === v);
                    setForm({ ...form, country_id: v, province_id: null, city_id: null, fee_currency: c?.currency_code ?? form.fee_currency, cmv_currency: c?.currency_code ?? form.cmv_currency });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.currency_code})</SelectItem>)}
                    <SelectItem value="__new__" className="text-primary font-medium">+ Crear nuevo país…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newCountry && (
                <div className="col-span-2 grid grid-cols-3 gap-3 p-3 rounded-md border border-primary/40 bg-primary/5">
                  <div className="col-span-3">
                    <Label className="text-xs">País *</Label>
                    <Select
                      value={newCountry.isoCode || "none"}
                      onValueChange={(isoCode) => {
                        const selected = availableCountries.find((country) => country.isoCode === isoCode);
                        const currency = selected?.currency?.split(",")?.[0]?.trim() ?? "";
                        setNewCountry({
                          name: selected?.name ?? "",
                          isoCode,
                          currency_code: currency,
                          currency_symbol: currency,
                        });
                        setNewCountryProvince("");
                        setNewCountryCity("");
                        setForm((f: any) => ({ ...f, fee_currency: currency || f.fee_currency, cmv_currency: currency || f.cmv_currency, province_id: null, city_id: null }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
                      <SelectContent>
                        {availableCountries.map((country) => <SelectItem key={country.isoCode} value={country.isoCode}>{country.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Estado / Provincia</Label>
                    <Select value={newCountryProvince || "none"} onValueChange={(v) => { setNewCountryProvince(v === "none" ? "" : v); setNewCountryCity(""); }} disabled={!newCountry.isoCode}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin especificar</SelectItem>
                        {availableStates.map((state) => <SelectItem key={state.isoCode} value={state.isoCode}>{state.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Ciudad</Label>
                    <Select value={newCountryCity || "none"} onValueChange={(v) => setNewCountryCity(v === "none" ? "" : v)} disabled={!newCountryProvince}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin especificar</SelectItem>
                        {availableCities.map((city) => <SelectItem key={`${city.name}-${city.latitude}-${city.longitude}`} value={city.name}>{city.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Moneda</Label>
                    <Input value={newCountry.currency_code} onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setNewCountry({ ...newCountry, currency_code: code });
                      setForm((f: any) => ({ ...f, fee_currency: code || f.fee_currency, cmv_currency: code || f.cmv_currency }));
                    }} maxLength={5} />
                  </div>
                  <div>
                    <Label className="text-xs">Símbolo</Label>
                    <Input value={newCountry.currency_symbol} onChange={(e) => setNewCountry({ ...newCountry, currency_symbol: e.target.value })} maxLength={5} />
                  </div>
                  <p className="col-span-3 text-[11px] text-muted-foreground">Se creará el país con su moneda y, si los elegís, también su provincia/estado y ciudad inicial.</p>
                </div>
              )}
              <div>
                <Label>Cantidad de sucursales *</Label>
                <Input type="number" min={1} value={form.branches_count ?? 1} onChange={(e) => setForm({ ...form, branches_count: e.target.value })} />
              </div>
              <div>
                <Label>Categoría de comida</Label>
                <Select value={form.food_category_id ?? "none"} onValueChange={(v) => setForm({ ...form, food_category_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {foodCategories.map((cat: any) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    <SelectItem value="__new__" className="text-primary font-medium">+ Crear nueva categoría…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.food_category_id === "__new__" && (
                <div className="col-span-2">
                  <Label>Nueva categoría gastronómica *</Label>
                  <Input placeholder="Ej: Comida peruana" value={newFoodCategory} onChange={(e) => setNewFoodCategory(e.target.value)} />
                </div>
              )}
              <div>
                <Label>Estado</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha de alta (activated_at)</Label>
                <Input
                  type="date"
                  value={form.activated_at ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, activated_at: e.target.value || null })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isAdmin ? "Solo Dirección. Usada para MRR histórico. No puede ser futura ni posterior a pausa/baja." : "Solo editable por Dirección."}
                  {form.paused_at && <> · Pausado: {form.paused_at}</>}
                  {form.churned_at && <> · Baja: {form.churned_at}</>}
                </p>
              </div>
              <div>
                <Label>Frecuencia de cobro</Label>
                <Select value={form.billing_frequency ?? "monthly"} onValueChange={(v) => setForm({ ...form, billing_frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_FREQUENCY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de pago</Label>
                <Select value={form.payment_method_id ?? "none"} onValueChange={(v) => setForm({ ...form, payment_method_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {paymentMethods.map((method: any) => <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>)}
                    <SelectItem value="__new__" className="text-primary font-medium">+ Crear nueva forma de pago…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.payment_method_id === "__new__" && (
                <div>
                  <Label>Nueva forma de pago *</Label>
                  <Input placeholder="Ej: PayPal" value={newPaymentMethod} onChange={(e) => setNewPaymentMethod(e.target.value)} />
                </div>
              )}
              <div>
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
          </section>

          {/* Económico */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Económico</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Modalidad de cobro *</Label>
                <Select value={form.fee_billing_mode ?? "per_branch"} onValueChange={(v) => setForm({ ...form, fee_billing_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Fee único (no se multiplica por sucursales)</SelectItem>
                    <SelectItem value="per_branch">Fee por sucursal (se multiplica por la cantidad de sucursales)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.fee_billing_mode === "flat" ? "Fee único *" : "Fee por sucursal *"}</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" min={0} value={form.monthly_fee ?? 0} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
                  <Select value={form.fee_currency ?? defaultCurrency} onValueChange={(v) => setForm({ ...form, fee_currency: v })}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const c = countries.find((x: any) => x.id === form.country_id);
                        const opts: { code: string; label: string }[] = [];
                        const push = (code: string, label: string) => { if (code && !opts.find((o) => o.code === code)) opts.push({ code, label }); };
                        if (c?.currency_code) push(c.currency_code, `${c.currency_code} (local)`);
                        push("USD", "USD");
                        push("EUR", "EUR");
                        if (form.fee_currency) push(form.fee_currency, form.fee_currency);
                        return opts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>);
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                {form.fee_billing_mode !== "flat" && Number(form.branches_count) > 0 && Number(form.monthly_fee) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Total ({form.branches_count} {Number(form.branches_count) === 1 ? "sucursal" : "sucursales"}):{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {formatMoney(Number(form.monthly_fee || 0) * Number(form.branches_count || 1), form.fee_currency)}
                    </span>
                  </p>
                )}
                {form.fee_billing_mode === "flat" && Number(form.monthly_fee) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Total: <span className="font-mono font-semibold text-foreground">{formatMoney(Number(form.monthly_fee || 0), form.fee_currency)}</span>
                  </p>
                )}
              </div>
              <div>
                <Label>CMV (Costo de Mercadería Vendida) %</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={form.cmv_cost ?? 0}
                    onChange={(e) => setForm({ ...form, cmv_cost: e.target.value })}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </section>

          {/* Dirección */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dirección (opcional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Provincia</Label>
                <Select
                  value={form.province_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, province_id: v === "none" ? null : v, city_id: null })}
                  disabled={!form.country_id}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {provinces.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ciudad</Label>
                <Select
                  value={form.city_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, city_id: v === "none" ? null : v })}
                  disabled={!form.province_id}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {cities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Dirección</Label>
                <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle, número, piso..." />
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contacto (opcional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Persona de contacto</Label>
                <Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div>
                <Label>Celular</Label>
                <Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+54 ..." />
              </div>
              <div>
                <Label>Email de contacto</Label>
                <Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div>
                <Label>Email para envío de informes</Label>
                <Input type="email" value={form.reports_email ?? ""} onChange={(e) => setForm({ ...form, reports_email: e.target.value })} />
              </div>
            </div>
          </section>

          {/* Sub-marcas */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sub-marcas</h3>
              <Button type="button" variant="outline" size="sm" onClick={addSubBrand}><Plus className="h-4 w-4" />Agregar sub-marca</Button>
            </div>
            {subBrands.length > 0 && (
              <div className="space-y-3">
                {subBrands.map((brand, index) => (
                  <div key={brand.id ?? index} className="space-y-3 rounded-md border border-border bg-card/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Sub-marca {index + 1}</Label>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSubBrand(index)}><X className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nombre *</Label><Input value={brand.name ?? ""} onChange={(e) => updateSubBrand(index, { name: e.target.value })} /></div>
                      <div>
                        <Label>Categoría de comida</Label>
                        <Select value={brand.food_category_id ?? "none"} onValueChange={(v) => updateSubBrand(index, { food_category_id: v === "none" ? null : v })}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin especificar</SelectItem>
                            {foodCategories.map((cat: any) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                            <SelectItem value="__new__">Usar nueva categoría del cliente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>País *</Label>
                        <Select value={brand.country_id ?? form.country_id ?? ""} onValueChange={(v) => {
                          const c = countries.find((x: any) => x.id === v);
                          updateSubBrand(index, { country_id: v, province_id: null, city_id: null, fee_currency: c?.currency_code ?? brand.fee_currency, cmv_currency: c?.currency_code ?? brand.cmv_currency });
                        }}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>{countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.currency_code})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Sucursales *</Label><Input type="number" min={1} value={brand.branches_count ?? 1} onChange={(e) => updateSubBrand(index, { branches_count: e.target.value })} /></div>
                      <div>
                        <Label>Modalidad</Label>
                        <Select value={brand.fee_billing_mode ?? "per_branch"} onValueChange={(v) => updateSubBrand(index, { fee_billing_mode: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Fee único</SelectItem>
                            <SelectItem value="per_branch">Fee por sucursal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{brand.fee_billing_mode === "flat" ? "Fee único" : "Fee por sucursal"}</Label>
                        <div className="flex gap-2">
                          <Input type="number" step="0.01" min={0} value={brand.monthly_fee ?? 0} onChange={(e) => updateSubBrand(index, { monthly_fee: e.target.value })} />
                          <Select value={brand.fee_currency ?? defaultCurrency} onValueChange={(v) => updateSubBrand(index, { fee_currency: v })}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const c = countries.find((x: any) => x.id === (brand.country_id ?? form.country_id));
                                const opts: { code: string; label: string }[] = [];
                                const push = (code: string, label: string) => { if (code && !opts.find((o) => o.code === code)) opts.push({ code, label }); };
                                if (c?.currency_code) push(c.currency_code, `${c.currency_code} (local)`);
                                push("USD", "USD");
                                push("EUR", "EUR");
                                if (brand.fee_currency) push(brand.fee_currency, brand.fee_currency);
                                return opts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>);
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                        {Number(brand.monthly_fee) > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Total: <span className="font-mono font-semibold text-foreground">{formatMoney(
                              brand.fee_billing_mode === "flat"
                                ? Number(brand.monthly_fee || 0)
                                : Number(brand.monthly_fee || 0) * Number(brand.branches_count || 1),
                              brand.fee_currency,
                            )}</span>
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Frecuencia de cobro</Label>
                        <Select value={brand.billing_frequency ?? "monthly"} onValueChange={(v) => updateSubBrand(index, { billing_frequency: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BILLING_FREQUENCY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>CMV %</Label><Input type="number" step="0.01" min={0} max={100} value={brand.cmv_cost ?? 0} onChange={(e) => updateSubBrand(index, { cmv_cost: e.target.value })} /></div>
                      <div><Label>Dirección</Label><Input value={brand.address ?? ""} onChange={(e) => updateSubBrand(index, { address: e.target.value })} /></div>
                      <div><Label>Persona de contacto</Label><Input value={brand.contact_name ?? ""} onChange={(e) => updateSubBrand(index, { contact_name: e.target.value })} /></div>
                      <div><Label>Celular</Label><Input value={brand.contact_phone ?? ""} onChange={(e) => updateSubBrand(index, { contact_phone: e.target.value })} /></div>
                      <div><Label>Email de contacto</Label><Input type="email" value={brand.contact_email ?? ""} onChange={(e) => updateSubBrand(index, { contact_email: e.target.value })} /></div>
                      <div><Label>Email informes</Label><Input type="email" value={brand.reports_email ?? ""} onChange={(e) => updateSubBrand(index, { reports_email: e.target.value })} /></div>
                      <div><Label>Estado</Label><Select value={brand.status ?? "active"} onValueChange={(v) => updateSubBrand(index, { status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select></div>
                      <div className="col-span-2"><Label>Notas</Label><Textarea rows={2} value={brand.notes ?? ""} onChange={(e) => updateSubBrand(index, { notes: e.target.value })} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Plataformas */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Plataformas activas</h3>
            <div className="space-y-2 border border-border rounded-md p-3 bg-card/40">
              {platforms.map((p: any) => {
                const sel = selectedPlatforms[p.id];
                return (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-6 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!sel?.selected}
                        onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, [p.id]: { commission_rate: sel?.commission_rate ?? 0, selected: e.target.checked } })}
                      />
                      {p.name}
                    </label>
                    <div className="col-span-6">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Comisión %"
                        disabled={!sel?.selected}
                        value={sel?.commission_rate ?? ""}
                        onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, [p.id]: { selected: true, commission_rate: Number(e.target.value) } })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Comisiones ejecutivos */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Comisiones de ejecutivos por este cliente</h3>
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
          </section>

          {/* Cobranza */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Cobranza</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quién cobra</Label>
                <Select value={form.payment_channel ?? "none"} onValueChange={(v) => setForm({ ...form, payment_channel: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar canal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {PAYMENT_CHANNEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Usuario asignado a facturar</Label>
                <Select value={form.billing_user_id ?? "none"} onValueChange={(v) => setForm({ ...form, billing_user_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vencimiento (días)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={form.payment_term_days ?? 5}
                  onChange={(e) => setForm({ ...form, payment_term_days: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Días desde la fecha de factura hasta el vencimiento.</p>
              </div>
              <div>
                <Label>Tipo de Factura</Label>
                <Select value={form.invoice_letter ?? "none"} onValueChange={(v) => setForm({ ...form, invoice_letter: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin definir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    <SelectItem value="B">B — Blanco / formal</SelectItem>
                    <SelectItem value="N">N — Negro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </section>

          {/* Descuento */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Descuento</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Porcentaje (%)</Label>
                <Input type="number" min={0} max={100} step="0.01" value={form.discount_percentage ?? ""} onChange={(e) => {
                  const v = e.target.value;
                  setForm({ ...form, discount_percentage: v === "" ? null : v, discount_active: v !== "" && Number(v) > 0 });
                }} />
              </div>
              <div>
                <Label>Duración</Label>
                <Select value={form.discount_duration ?? "none"} onValueChange={(v) => {
                  if (v === "none") {
                    setForm({ ...form, discount_duration: null, discount_starts_at: null, discount_ends_at: null });
                    return;
                  }
                  const opt = DISCOUNT_DURATION_OPTIONS.find((o) => o.value === v);
                  const starts = new Date().toISOString().slice(0, 10);
                  const ends = opt?.days ? addDaysISO(opt.days) : form.discount_ends_at ?? null;
                  setForm({ ...form, discount_duration: v, discount_starts_at: starts, discount_ends_at: ends });
                }}>
                  <SelectTrigger><SelectValue placeholder="Sin descuento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin descuento</SelectItem>
                    {DISCOUNT_DURATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vence el</Label>
                <Input type="date" value={form.discount_ends_at ?? ""} disabled={form.discount_duration && form.discount_duration !== "custom"} onChange={(e) => setForm({ ...form, discount_ends_at: e.target.value || null })} />
              </div>
              {form.discount_percentage && Number(form.discount_percentage) > 0 && (
                <div className="col-span-3 text-sm rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1">
                  {form.fee_billing_mode === "flat" ? (
                    <div>
                      Fee único con descuento:{" "}
                      <span className="font-mono font-semibold">
                        {formatMoney(Number(form.monthly_fee || 0) * (1 - Number(form.discount_percentage) / 100), form.fee_currency)}
                      </span>
                      {form.discount_ends_at && <> · vence el <strong>{fmtDate(form.discount_ends_at)}</strong></>}
                    </div>
                  ) : (
                    <>
                      <div>
                        Por sucursal con descuento:{" "}
                        <span className="font-mono font-semibold">
                          {formatMoney(Number(form.monthly_fee || 0) * (1 - Number(form.discount_percentage) / 100), form.fee_currency)}
                        </span>
                      </div>
                      <div>
                        Total ({form.branches_count} {Number(form.branches_count) === 1 ? "sucursal" : "sucursales"}) con descuento:{" "}
                        <span className="font-mono font-semibold">
                          {formatMoney(
                            Number(form.monthly_fee || 0) * Number(form.branches_count || 1) * (1 - Number(form.discount_percentage) / 100),
                            form.fee_currency,
                          )}
                        </span>
                        {form.discount_ends_at && <> · vence el <strong>{fmtDate(form.discount_ends_at)}</strong></>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Historial de precios */}
          {client && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Historial de precios</h3>
              <PriceHistoryTimeline clientId={client.id} />
            </section>
          )}

          {/* Notas */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notas</h3>
            <Textarea rows={4} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Información adicional..." />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={
              save.isPending ||
              !form.company_name ||
              (!form.country_id && !(newCountry && newCountry.name && newCountry.currency_code && newCountry.currency_symbol))
            }
          >
            {save.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
