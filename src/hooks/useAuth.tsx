import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "executive";

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
      if (s?.user) {
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
      if (mounted) setLoading(false);
    });

    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3500));
    Promise.race([
      supabase.auth.getSession().then(({ data: { session: s } }) => s),
      timeout,
    ]).then((s) => applySession(s)).catch(() => applySession(null)).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function fetchRole(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (data && data.length) {
      // admin wins if multiple
      const isAdmin = data.some((r: any) => r.role === "admin");
      setRole(isAdmin ? "admin" : "executive");
    } else {
      setRole(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, user, role, loading, signOut, isAdmin: role === "admin" };
}
