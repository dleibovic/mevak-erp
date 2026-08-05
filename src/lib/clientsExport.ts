import * as XLSX from "xlsx";
import { PAYMENT_CHANNEL_LABEL } from "@/lib/billing";

// Descarga de la planilla de clientes (Excel .xlsx).
// Requiere el paquete `xlsx` (SheetJS). Lovable lo instala automáticamente al importarlo.

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

/** Comisiones del cliente: suma por moneda (un cliente puede tener varios ejecutivos). */
function commissionText(rows: any[] = []): string {
  if (!rows || !rows.length) return "";
  const byCur: Record<string, number> = {};
  for (const r of rows) {
    const cur = r.currency || "ARS";
    byCur[cur] = (byCur[cur] || 0) + (Number(r.commission_value) || 0);
  }
  return Object.entries(byCur)
    .map(([cur, v]) => `${money(v)} ${cur}`)
    .join(" / ");
}

/**
 * Genera y descarga un Excel con todos los clientes recibidos.
 * @param clients  filas de clientes (con executive, client_executive_commission, etc.)
 * @param profileName  función id -> nombre del responsable de facturar
 */
export function exportClientsExcel(
  clients: any[],
  profileName: (id?: string | null) => string,
) {
  const rows = (clients ?? []).map((c) => ({
    "Cliente": c.company_name ?? "",
    "Razón Social": c.legal_name ?? "",
    "CUIT": c.tax_id ?? "",
    "Fee del cliente": c.monthly_fee != null ? `${money(c.monthly_fee)} ${c.fee_currency ?? ""}`.trim() : "",
    "Persona de contacto": c.contact_name ?? "",
    "Celular": c.contact_phone ?? "",
    "Mail de envío de factura": c.contact_email || c.reports_email || "",
    "Quién factura": c.billing_user_id ? profileName(c.billing_user_id) : "",
    "Quién cobra / por dónde": c.payment_channel ? (PAYMENT_CHANNEL_LABEL[c.payment_channel] ?? c.payment_channel) : "",
    "Recurso que lleva la cuenta": c.executive?.full_name ?? "",
    "Comisión": commissionText(c.client_executive_commission),
    "Anotaciones": c.notes ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 26 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 16 },
    { wch: 30 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 22 }, { wch: 44 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `clientes-mevak-${today}.xlsx`);
}
