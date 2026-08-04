import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "administracion" | "executive";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const applySession = (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => fetchRole(s.user.id), 0);
      else setRole(null);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      applySession(s);
      if (mounted) setLoading(false);
    });
    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3500));
    Promise.race([supabase.auth.getSession().then(({ data: { session: s } }) => s), timeout])
      .then((s) => applySession(s)).catch(() => applySession(null))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function fetchRole(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const roles = (data ?? []).map((r: any) => r.role);
    // prioridad: admin > administracion > executive
    if (roles.includes("admin")) setRole("admin");
    else if (roles.includes("administracion")) setRole("administracion");
    else if (roles.includes("executive")) setRole("executive");
    else setRole(null);
  }

  async function signOut() { await supabase.auth.signOut(); }

  return {
    session, user, role, loading, signOut,
    isAdmin: role === "admin",
    isAdministracion: role === "administracion",
    // puede crear/editar en finanzas, clientes y CRM (NO eliminar, NO gestionar usuarios)
    canEditAdminFinance: role === "admin" || role === "administracion",
  };
}
