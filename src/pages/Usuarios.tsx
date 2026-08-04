import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { PageContainer, PageHeader, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "administracion", label: "Administración" },
  { value: "executive", label: "Ejecutivo" },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  administracion: "Administración",
  executive: "Ejecutivo",
};

function topRole(roles: string[]): AppRole | null {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("administracion")) return "administracion";
  if (roles.includes("executive")) return "executive";
  return null;
}

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
};

export default function Usuarios() {
  const qc = useQueryClient();
  const { isAdmin, loading, user } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "executive" as AppRole });
  const [pendingChange, setPendingChange] = useState<{ row: UserRow; role: AppRole } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    enabled: isAdmin,
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const byUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
      });
      return (profiles ?? [])
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          role: topRole(byUser.get(p.id) ?? []),
        }))
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    },
  });

  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);

  const createUser = useMutation({
    mutationFn: async () => {
      const full_name = form.full_name.trim();
      const email = form.email.trim();
      if (!full_name) throw new Error("El nombre es obligatorio");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");
      if (form.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { full_name, email, password: form.password, role: form.role },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).message ?? (data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Usuario creado");
      setCreateOpen(false);
      setForm({ full_name: "", email: "", password: "", role: "executive" });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo crear el usuario"),
  });

  const changeRole = useMutation({
    mutationFn: async ({ row, role }: { row: UserRow; role: AppRole }) => {
      if (row.role === "admin" && role !== "admin" && adminCount <= 1) {
        throw new Error("No podés quitar el último rol admin");
      }
      if (row.id === user?.id && role !== "admin" && row.role === "admin") {
        throw new Error("No podés quitarte a vos mismo el rol admin");
      }
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", row.id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: row.id, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo actualizar el rol"),
    onSettled: () => setPendingChange(null),
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageContainer>
      <PageHeader
        title="Usuarios"
        description="Altas y roles de acceso al ERP"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nuevo usuario
          </Button>
        }
      />

      <Card className="bg-gradient-card border-border/60">
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Cargando...</p>
        ) : users.length === 0 ? (
          <div className="p-6"><EmptyState title="Sin usuarios" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol actual</TableHead>
                <TableHead className="w-[220px]">Cambiar rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    {u.role
                      ? <Badge variant={u.role === "admin" ? "default" : "secondary"}>{ROLE_LABEL[u.role]}</Badge>
                      : <Badge variant="outline">Sin rol</Badge>}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role ?? ""}
                      onValueChange={(v) => setPendingChange({ row: u, role: v as AppRole })}
                    >
                      <SelectTrigger><SelectValue placeholder="Asignar rol" /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={form.full_name} maxLength={200}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={form.password} maxLength={72}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
              {createUser.isPending ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingChange} onOpenChange={(o) => { if (!o) setPendingChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar el rol?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange && (
                <>Se reemplazarán los roles actuales de {pendingChange.row.full_name ?? pendingChange.row.email} por «{ROLE_LABEL[pendingChange.role]}».</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingChange && changeRole.mutate(pendingChange)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
