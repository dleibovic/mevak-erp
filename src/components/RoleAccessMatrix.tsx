import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { MENU_ROUTES, ADMIN_HARD_ROUTES } from "@/lib/menuRoutes";

const ROLES = [
  { role: "administracion", label: "Administración" },
  { role: "executive", label: "Ejecutivo" },
] as const;

export function RoleAccessMatrix() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["role_menu_access_matrix"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_menu_access" as any).select("role, route, visible");
      if (error) throw error;
      return (data ?? []) as unknown as { role: string; route: string; visible: boolean }[];
    },
  });
  const map = new Map((data ?? []).map((r) => [`${r.role}|${r.route}`, r.visible]));

  const toggle = useMutation({
    mutationFn: async (v: { role: string; route: string; visible: boolean }) => {
      const { error } = await supabase
        .from("role_menu_access" as any)
        .upsert({ ...v, updated_at: new Date().toISOString() } as any, { onConflict: "role,route" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role_menu_access_matrix"] });
      qc.invalidateQueries({ queryKey: ["role_menu_access"] });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo guardar"),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground break-words">
        Esto controla qué secciones ve cada rol en el menú. La seguridad de los datos sigue estando en los permisos de la base (RLS); ocultar una sección no da acceso por sí solo.
      </p>
      <Card className="bg-gradient-card border-border/60 overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Cargando...</p>
        ) : (
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow>
                <TableHead>Sección</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                {ROLES.map((r) => <TableHead key={r.role} className="text-center">{r.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MENU_ROUTES.map((m) => {
                const hard = ADMIN_HARD_ROUTES.has(m.route);
                return (
                  <TableRow key={m.route}>
                    <TableCell>
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground">{m.route}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" />Todo</Badge>
                    </TableCell>
                    {ROLES.map((r) => (
                      <TableCell key={r.role} className="text-center">
                        {hard ? (
                          <span className="text-xs text-muted-foreground">Solo admin</span>
                        ) : (
                          <Switch
                            checked={map.get(`${r.role}|${m.route}`) ?? false}
                            disabled={toggle.isPending}
                            onCheckedChange={(visible) => toggle.mutate({ role: r.role, route: m.route, visible })}
                            aria-label={`${m.label} para ${r.label}`}
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
