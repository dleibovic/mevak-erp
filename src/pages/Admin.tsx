import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useCountries, usePlatforms, useExpenseCategories, useContactChannels, useLostReasons, useFunnelStages } from "@/hooks/useCatalogs";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

        <TabsContent value="platforms"><CatalogManager table="platforms" hook={usePlatforms} label="plataforma" /></TabsContent>
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

function CountriesManager() {
  const { data = [] } = useCountries();
  return (
    <Card className="p-5 bg-gradient-card border-border/60 mt-4">
      <p className="text-sm text-muted-foreground mb-3">Los países y monedas vienen preconfigurados (Argentina/España).</p>
      <div className="space-y-2">
        {data.map((c: any) => (
          <div key={c.id} className="flex justify-between items-center px-3 py-2 rounded-md bg-card/40 border border-border">
            <span className="font-medium">{c.name}</span>
            <span className="text-sm text-muted-foreground">{c.currency_code} ({c.currency_symbol})</span>
          </div>
        ))}
      </div>
    </Card>
  );
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
