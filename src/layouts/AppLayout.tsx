import { NavLink, useLocation, Outlet, Navigate } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, Wallet, UserCog, Settings, LogOut, AlertTriangle, BarChart3, Target, Activity, TrendingDown, PiggyBank, ShieldCheck, LineChart as LineChartIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";
import { NotificationsBell } from "@/components/NotificationsBell";
import { AsistenteWidget } from "@/components/AsistenteWidget";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_HARD_ROUTES, matchMenuRoute } from "@/lib/menuRoutes";

const NAV_GROUPS: { group: string; items: any[] }[] = [
  {
    group: "Día a día",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/alertas", label: "Alertas", icon: AlertTriangle },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/prospecting", label: "Prospecting", icon: Target },
      { to: "/facturacion", label: "Facturación", icon: Receipt },
    ],
  },
  {
    group: "Equipo & finanzas",
    items: [
      { to: "/gastos", label: "Gastos", icon: Wallet, financeOnly: true },
      { to: "/empleados", label: "Empleados", icon: UserCog, adminOnly: true },
    ],
  },
  {
    group: "Inteligencia",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/metricas-saas", label: "Métricas SaaS", icon: Activity },
      { to: "/churn", label: "Churn", icon: TrendingDown },
      { to: "/ltv-rentabilidad", label: "LTV & Rentabilidad", icon: PiggyBank },
      { to: "/estadisticas", label: "Estadísticas", icon: LineChartIcon, adminOnly: true },
    ],
  },
  {
    group: "Administración",
    items: [
      { to: "/usuarios", label: "Usuarios y Roles", icon: ShieldCheck, adminOnly: true },
      { to: "/admin", label: "Configuración", icon: Settings, adminOnly: true },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);


export default function AppLayout() {
  const { user, loading, signOut, isAdmin, canEditAdminFinance, role } = useAuth();
  const location = useLocation();

  const { data: accessRows } = useQuery({
    queryKey: ["role_menu_access", role],
    enabled: !!user && !!role,
    queryFn: async () => {
      const { data, error } = await supabase.from("role_menu_access" as any).select("route, visible").eq("role", role as any);
      if (error) throw error;
      return (data ?? []) as unknown as { route: string; visible: boolean }[];
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  const visibleSet = accessRows && accessRows.length ? new Set(accessRows.filter((r) => r.visible).map((r) => r.route)) : null;
  const allowed = (n: any) => {
    if (isAdmin) return true;
    if (ADMIN_HARD_ROUTES.has(n.to)) return false;
    if (visibleSet) return visibleSet.has(n.to);
    return (!n.adminOnly || isAdmin) && (!n.financeOnly || canEditAdminFinance);
  };
  const items = NAV.filter(allowed);

  const current = matchMenuRoute(location.pathname);
  if (current && current !== "/" && !allowed({ ...NAV.find((n: any) => n.to === current), to: current })) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex-col">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-20 shrink-0 items-center justify-center rounded-md bg-primary px-2">
              <img src="/logo-mevak.png" alt="Mevak" className="max-h-7 w-full object-contain" />
            </span>
            <div>
              <div className="font-semibold text-primary">Mevak</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ERP suite</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-2">
          {NAV_GROUPS.map((grp) => {
            const visible = grp.items.filter(allowed);
            if (!visible.length) return null;
            return (
              <div key={grp.group}>
                <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {grp.group}
                </div>
                <div className="space-y-0.5">
                  {visible.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.end}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                         isActive
                           ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <it.icon className="h-4 w-4" />
                      <span className="flex-1">{it.label}</span>
                      {it.to === "/prospecting" && <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-destructive-foreground">0</span>}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>


        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 py-2 text-xs text-muted-foreground truncate">
            {user.email}
            <div className="text-[10px] uppercase tracking-wider mt-0.5 text-primary/80">{role}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 relative pb-20 md:pb-0 max-md:overflow-x-clip">
        <div className="absolute inset-x-0 top-0 h-64 bg-glow pointer-events-none" />
        <header className="relative z-10 min-h-14 min-w-0 border-b border-border/60 bg-background/80 backdrop-blur flex flex-wrap items-center justify-between md:justify-end px-4 md:px-6 py-3 gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Vista por país</span>
          <CountryFilterSelect className="w-[min(180px,100%)]" />
          <NotificationsBell />
          <ThemeToggle />
        </header>
        <div className="relative">
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
      <AsistenteWidget />
      <nav className="no-scrollbar fixed inset-x-0 bottom-0 z-40 flex max-w-[100vw] gap-1 overflow-x-auto border-t border-sidebar-border bg-sidebar/95 px-2 py-2 backdrop-blur [-webkit-overflow-scrolling:touch] md:hidden">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => cn(
              "flex min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] transition-colors",
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"
            )}
          >
            <it.icon className="h-4 w-4 shrink-0" />
            <span className="max-w-full truncate">{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
