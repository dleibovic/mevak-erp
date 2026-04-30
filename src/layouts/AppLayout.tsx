import { NavLink, useLocation, Outlet, Navigate } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, Wallet, UserCog, Settings, LogOut, AlertTriangle, BarChart3, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CountryFilterSelect } from "@/components/CountryFilterSelect";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/prospecting", label: "Prospecting", icon: Target },
  { to: "/facturacion", label: "Facturación", icon: Receipt },
  { to: "/empleados", label: "Empleados", icon: UserCog, adminOnly: true },
  { to: "/gastos", label: "Gastos", icon: Wallet, adminOnly: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/alertas", label: "Alertas", icon: AlertTriangle },
  { to: "/admin", label: "Configuración", icon: Settings, adminOnly: true },
];

export default function AppLayout() {
  const { user, loading, signOut, isAdmin, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  const items = NAV.filter(n => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex-col">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-primary shadow-elevated" />
            <div>
              <div className="font-semibold tracking-tight">Mevak</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ERP suite</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <it.icon className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
              {it.to === "/prospecting" && <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-destructive-foreground">0</span>}
            </NavLink>
          ))}
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

      <main className="flex-1 min-w-0 relative pb-20 md:pb-0">
        <div className="absolute inset-x-0 top-0 h-64 bg-glow pointer-events-none" />
        <header className="relative z-10 min-h-14 border-b border-border/60 bg-background/80 backdrop-blur flex flex-wrap items-center justify-between md:justify-end px-4 md:px-6 py-3 gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Vista por país</span>
          <CountryFilterSelect />
        </header>
        <div className="relative">
          <Outlet />
        </div>
      </main>
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
