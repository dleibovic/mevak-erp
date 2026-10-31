// Filtro "Pidió auditoría": un prospecto pidió la auditoría gratis cuando
// prospects.audit_requested_at no es null (lo setea ingest-lead).

export type AuditFilter = "all" | "yes" | "no";

/** Lee el valor del parámetro de URL `auditoria` (si | no). Cualquier otro valor = todos. */
export function parseAuditParam(v: string | null | undefined): AuditFilter {
  return v === "si" ? "yes" : v === "no" ? "no" : "all";
}

/** Valor para el parámetro de URL `auditoria`, o null para quitarlo. */
export function auditParamValue(f: AuditFilter): string | null {
  return f === "yes" ? "si" : f === "no" ? "no" : null;
}

export function matchesAuditFilter(p: { audit_requested_at?: string | null }, f: AuditFilter): boolean {
  if (f === "all") return true;
  const requested = !!p.audit_requested_at;
  return f === "yes" ? requested : !requested;
}

/** Con el filtro en "Sí", los pedidos más recientes primero. En otro caso, conserva el orden. */
export function sortForAudit<T extends { audit_requested_at?: string | null }>(rows: T[], f: AuditFilter): T[] {
  if (f !== "yes") return rows;
  return [...rows].sort((a, b) => Date.parse(b.audit_requested_at ?? "") - Date.parse(a.audit_requested_at ?? ""));
}

/** dd/mm/yyyy en hora de Buenos Aires. */
export function formatAuditDate(iso?: string | null): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}
