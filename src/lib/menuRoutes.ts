export const MENU_ROUTES: { route: string; label: string }[] = [
  { route: "/", label: "Dashboard" },
  { route: "/alertas", label: "Alertas" },
  { route: "/clientes", label: "Clientes" },
  { route: "/prospecting", label: "Prospecting" },
  { route: "/facturacion", label: "Facturación" },
  { route: "/gastos", label: "Gastos" },
  { route: "/empleados", label: "Empleados" },
  { route: "/analytics", label: "Analytics" },
  { route: "/metricas-saas", label: "Métricas SaaS" },
  { route: "/estadisticas", label: "Estadísticas" },
  { route: "/usuarios", label: "Usuarios y Roles" },
  { route: "/admin", label: "Configuración" },
];

/** Routes that only admin can ever see; not configurable. */
export const ADMIN_HARD_ROUTES = new Set(["/usuarios", "/admin"]);

/** Returns the known menu route a pathname belongs to, if any. */
export function matchMenuRoute(pathname: string): string | null {
  if (pathname === "/") return "/";
  const hit = MENU_ROUTES.find((r) => r.route !== "/" && (pathname === r.route || pathname.startsWith(r.route + "/")));
  return hit?.route ?? null;
}
