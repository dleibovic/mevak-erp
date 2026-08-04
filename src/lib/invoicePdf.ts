import { jsPDF } from "jspdf";
import { MEVAK_LOGO_BLANCO } from "@/lib/mevakLogo";

// === DATOS DEL EMISOR (Mevak) — mínimos, factura comercial no fiscal ===
export const ISSUER = {
  name: "Mevak",
  email: "administracion@mevak.com.ar",
  web: "growth.mevakfoodagency.com",
};

// Colores de marca (design.md)
const BRAND_BG = "#14151F";
const BRAND_VIOLET = "#5961C0";
const BRAND_ORANGE = "#DD2F03";
const INK = "#1A1B23";
const MUTED = "#7E839A";

type InvoiceData = {
  number: string;
  invoiceDate: string;   // YYYY-MM-DD
  dueDate: string;       // YYYY-MM-DD
  clientName: string;
  amount: number;
  currency: string;
  concept?: string;
};

const money = (n: number, cur: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: cur || "USD" }).format(n);

/** Genera la factura. Devuelve { blob, filename }. Si download !== false, la descarga. */
export function generateInvoicePdf(inv: InvoiceData, opts?: { download?: boolean }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44;

  // Encabezado: banda oscura + franja naranja
  doc.setFillColor(BRAND_BG);
  doc.rect(0, 0, W, 96, "F");
  doc.setFillColor(BRAND_ORANGE);
  doc.rect(0, 96, W, 4, "F");

  // Logo blanco (fallback a wordmark si algo falla)
  try {
    const logoW = 120;
    const logoH = (logoW * 130) / 600; // ≈ 26
    doc.addImage(MEVAK_LOGO_BLANCO, "PNG", M, 34, logoW, logoH);
  } catch {
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("mevak", M, 60);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#C9CCF0");
  doc.text("INVOICE", W - M, 46, { align: "right" });
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(9);
  doc.text(`N° ${inv.number}`, W - M, 64, { align: "right" });

  // Emisor (mínimo): nombre + email + web
  let y = 132;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(ISSUER.name, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(ISSUER.email, M, y + 16);
  doc.text(ISSUER.web, M, y + 29);

  // Fechas (derecha)
  doc.setTextColor(INK);
  doc.setFontSize(9);
  doc.text(`Fecha de factura: ${inv.invoiceDate}`, W - M, y, { align: "right" });
  doc.text(`Vencimiento: ${inv.dueDate}`, W - M, y + 16, { align: "right" });

  // Cliente
  y += 80;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND_VIOLET);
  doc.text("FACTURAR A", M, y);
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text(inv.clientName, M, y + 19);

  // Tabla concepto / importe
  y += 56;
  doc.setFillColor("#ECEDF7");
  doc.rect(M, y, W - 2 * M, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(INK);
  doc.text("Concepto", M + 12, y + 17);
  doc.text("Importe", W - M - 12, y + 17, { align: "right" });

  y += 42;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(inv.concept || "Servicio de gestión de aplicaciones", M + 12, y);
  doc.text(money(inv.amount, inv.currency), W - M - 12, y, { align: "right" });

  // Total (regla + monto en naranja)
  y += 26;
  doc.setDrawColor(BRAND_ORANGE);
  doc.setLineWidth(1.4);
  doc.line(W - M - 220, y, W - M, y);
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text("Total", W - M - 160, y, { align: "right" });
  doc.setTextColor(BRAND_ORANGE);
  doc.setFontSize(14);
  doc.text(money(inv.amount, inv.currency), W - M - 12, y, { align: "right" });

  // Nota de pago (datos bancarios por email)
  y += 42;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(`Los datos bancarios para el pago se envían por email (${ISSUER.email}).`, M, y);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`${ISSUER.name} · ${ISSUER.web}`, M, H - 32);

  const filename = `Factura_${inv.clientName.replace(/\s+/g, "_")}_${inv.invoiceDate}.pdf`;
  const blob = doc.output("blob");
  if (opts?.download !== false) doc.save(filename);
  return { blob, filename };
}
