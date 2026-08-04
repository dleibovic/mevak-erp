import { jsPDF } from "jspdf";

// === DATOS DEL EMISOR (Mevak) — EDITAR con los datos reales ===
export const ISSUER = {
  name: "Mevak",
  legalName: "Mevak Food Agency",        // razón social — EDITAR
  taxId: "",                              // CUIT / Tax ID — EDITAR
  address: "",                            // dirección — EDITAR
  email: "hola@mevak.com.ar",             // EDITAR
  web: "growth.mevakfoodagency.com",
  payment: {                              // pago internacional (transferencia) — EDITAR
    bankName: "",
    accountName: "",
    iban: "",
    swift: "",
    notes: "",
  },
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

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo-mevak.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Genera la factura. Devuelve { blob, filename }. Si download !== false, la descarga. */
export async function generateInvoicePdf(inv: InvoiceData, opts?: { download?: boolean }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44;

  // Encabezado: banda oscura de marca + franja naranja
  doc.setFillColor(BRAND_BG);
  doc.rect(0, 0, W, 96, "F");
  doc.setFillColor(BRAND_ORANGE);
  doc.rect(0, 96, W, 4, "F");

  // Logo blanco (fallback al wordmark si no carga)
  const logoDataUrl = await loadLogoDataUrl();
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", M, 28, 120, 40);
  } else {
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("MEVAK", M, 58);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#C9CCF0");
  doc.text("INVOICE", W - M, 46, { align: "right" });
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(9);
  doc.text(`N° ${inv.number}`, W - M, 64, { align: "right" });

  // Emisor
  let y = 132;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(ISSUER.legalName || ISSUER.name, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  [ISSUER.address, ISSUER.taxId ? `Tax ID: ${ISSUER.taxId}` : "", ISSUER.email, ISSUER.web]
    .filter(Boolean).forEach((l, i) => doc.text(l as string, M, y + 16 + i * 13));

  // Fechas (derecha)
  doc.setTextColor(INK);
  doc.setFontSize(9);
  doc.text(`Fecha de factura: ${inv.invoiceDate}`, W - M, y, { align: "right" });
  doc.text(`Vencimiento: ${inv.dueDate}`, W - M, y + 16, { align: "right" });

  // Cliente
  y += 84;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND_VIOLET);
  doc.text("FACTURAR A", M, y);
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text(inv.clientName, M, y + 19);

  // Tabla concepto / importe (encabezado con tinte violeta claro)
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

  // Total (regla naranja + monto en naranja = número clave)
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

  // Datos de pago (internacionales)
  if (ISSUER.payment.bankName || ISSUER.payment.iban) {
    y += 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(BRAND_VIOLET);
    doc.text("DATOS DE PAGO", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK);
    const p = ISSUER.payment;
    [p.bankName && `Banco: ${p.bankName}`, p.accountName && `Titular: ${p.accountName}`,
     p.iban && `IBAN: ${p.iban}`, p.swift && `SWIFT/BIC: ${p.swift}`, p.notes]
      .filter(Boolean).forEach((l, i) => doc.text(l as string, M, y + 16 + i * 13));
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`${ISSUER.name} · ${ISSUER.web}`, M, H - 32);

  const filename = `Factura_${inv.clientName.replace(/\s+/g, "_")}_${inv.invoiceDate}.pdf`;
  const blob = doc.output("blob");
  if (opts?.download !== false) doc.save(filename);
  return { blob, filename };
}
