import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { evalInvoice, stateTone, totalsByCurrency, money, fmtPeriod, fmtDMY, todayISO, type StmtInvoice } from "@/lib/accountStatement";
import { PAYMENT_CHANNEL_LABEL } from "@/lib/billing";

const VIOLET: [number, number, number] = [93, 87, 214];
const VIOLET2: [number, number, number] = [80, 57, 192];
const VIOLET_LIGHT: [number, number, number] = [228, 226, 248];
const CREAM: [number, number, number] = [244, 241, 233];
const INK: [number, number, number] = [43, 40, 51];
const MUTED: [number, number, number] = [107, 103, 117];
const TONE: Record<string, [number, number, number]> = {
  paid: [22, 140, 75], overdue: [210, 40, 20], pending: [107, 103, 117], incobrable: [200, 130, 0], void: [160, 160, 170],
};
const FREQ: Record<string, string> = { weekly: "semanal", biweekly: "quincenal", monthly: "mensual" };

export function generateStatementPdf(client: any, invoices: StmtInvoice[], subBrands: { id: string; name: string }[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const today = todayISO();

  // Header band con degradé sutil
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(VIOLET[0] + (VIOLET2[0] - VIOLET[0]) * t),
      Math.round(VIOLET[1] + (VIOLET2[1] - VIOLET[1]) * t),
      Math.round(VIOLET[2] + (VIOLET2[2] - VIOLET[2]) * t),
    );
    doc.rect((W / steps) * i, 0, W / steps + 1, 86, "F");
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(28);
  doc.text("mevak", M, 54);
  doc.setFontSize(13);
  doc.text("ESTADO DE CUENTA", W - M, 44, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Al ${fmtDMY(today)}`, W - M, 60, { align: "right" });

  // Cliente
  let y = 118;
  const sbNames = subBrands.map((s) => s.name).filter(Boolean);
  doc.setTextColor(...VIOLET); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("CLIENTE", M, y);
  doc.setTextColor(...INK); doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(`${client.company_name}${sbNames.length ? ` (${sbNames.join(", ")})` : ""}`, W / 2 + 20);
  doc.text(nameLines, M, y + 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  const feeLine = `Fee mensual ${money(Number(client.monthly_fee || 0), client.fee_currency || "USD")} · facturación ${FREQ[client.billing_frequency] ?? client.billing_frequency ?? "mensual"}`;
  doc.text(feeLine, M, y + 16 + nameLines.length * 15);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Mevak", W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  doc.text("administracion@mevak.com.ar", W - M, y + 14, { align: "right" });
  doc.text("growth.mevakfoodagency.com", W - M, y + 28, { align: "right" });
  y = y + 40 + nameLines.length * 15;

  const sbMap = new Map(subBrands.map((s) => [s.id, s.name]));
  const valid = invoices.filter((i) => evalInvoice(i, today).state !== "Anulada");
  const currencies = Array.from(new Set(valid.map((i) => i.currency)));
  const totals = totalsByCurrency(valid, today);
  const hasGroups = subBrands.length > 0;

  const section = (title: string) => {
    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...VIOLET);
    doc.text(title, M, y); y += 8;
  };

  for (const cur of currencies) {
    const invs = valid.filter((i) => i.currency === cur);
    section(`FACTURAS${currencies.length > 1 ? ` · ${cur}` : ""}`);
    const body: any[] = [];
    const groups = hasGroups
      ? Array.from(new Set(invs.map((i) => i.sub_brand_id ?? ""))).map((k) => ({ key: k, name: sbMap.get(k) ?? "General", rows: invs.filter((i) => (i.sub_brand_id ?? "") === k) }))
      : [{ key: "", name: "", rows: invs }];
    for (const g of groups) {
      if (hasGroups) body.push([{ content: g.name, colSpan: 6, styles: { fillColor: VIOLET_LIGHT, textColor: VIOLET2, fontStyle: "bold" } }]);
      let sub = 0;
      for (const inv of g.rows) {
        const { state, saldo } = evalInvoice(inv, today);
        if (state !== "Incobrable") sub += saldo;
        body.push([fmtPeriod(inv.period_month), fmtDMY(inv.due_date), money(Number(inv.amount), cur), money(Number(inv.amount_paid || 0), cur), money(saldo, cur), { content: state, _tone: stateTone(state) }]);
      }
      if (hasGroups) body.push([{ content: `Saldo ${g.name}`, colSpan: 4, styles: { fontStyle: "bold", halign: "right" } }, { content: money(sub, cur), styles: { fontStyle: "bold" } }, ""]);
    }
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Período", "Vencimiento", "Importe", "Pagado", "Saldo", "Estado"]],
      body,
      styles: { fontSize: 8.5, textColor: INK, cellPadding: 5 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: CREAM },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "head" && [2, 3, 4].includes(d.column.index)) d.cell.styles.halign = "right";
        const raw: any = d.cell.raw;
        if (d.section === "body" && raw && raw._tone) {
          d.cell.styles.textColor = TONE[raw._tone];
          d.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 22;

    const pagos = invs.filter((i) => Number(i.amount_paid || 0) > 0);
    if (pagos.length) {
      section(`PAGOS RECIBIDOS${currencies.length > 1 ? ` · ${cur}` : ""}`);
      const tot = pagos.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Fecha", "Concepto", "Monto"]],
        body: [
          ...pagos.map((i) => [fmtDMY(i.paid_at), `Fee ${fmtPeriod(i.period_month)}${i.payment_channel ? ` · ${PAYMENT_CHANNEL_LABEL[i.payment_channel] ?? i.payment_channel}` : ""}`, money(Number(i.amount_paid), cur)]),
          [{ content: "Total pagos", colSpan: 2, styles: { fontStyle: "bold", halign: "right" } }, { content: money(tot, cur), styles: { fontStyle: "bold" } }],
        ],
        styles: { fontSize: 8.5, textColor: INK, cellPadding: 5 },
        headStyles: { fillColor: VIOLET, textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: CREAM },
        columnStyles: { 2: { halign: "right" } },
        didParseCell: (d) => { if (d.section === "head" && d.column.index === 2) d.cell.styles.halign = "right"; },
      });
      y = (doc as any).lastAutoTable.finalY + 22;
    }

    const t = totals[cur];
    section(`RESUMEN${currencies.length > 1 ? ` · ${cur}` : ""}`);
    const rows: any[] = [
      ["Total facturado", money(t.facturado, cur)],
      ["Total pagado", money(-t.cobrado, cur)],
      ["A vencer", money(t.aVencer, cur)],
      [{ content: "SALDO VENCIDO", styles: { textColor: TONE.overdue, fontStyle: "bold" } }, { content: money(t.vencido, cur), styles: { textColor: TONE.overdue, fontStyle: "bold" } }],
    ];
    if (t.incobrable > 0) rows.push(["Incobrable", money(t.incobrable, cur)]);
    rows.push([{ content: "Saldo total de la cuenta", styles: { textColor: VIOLET, fontStyle: "bold", fontSize: 10.5 } }, { content: money(t.saldoTotal, cur), styles: { textColor: VIOLET, fontStyle: "bold", fontSize: 10.5 } }]);
    autoTable(doc, {
      startY: y,
      margin: { left: W / 2, right: M },
      body: rows,
      theme: "plain",
      styles: { fontSize: 9, textColor: INK, cellPadding: 4 },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 28;
  }

  if (!currencies.length) {
    doc.setFontSize(10); doc.setTextColor(...MUTED);
    doc.text("No hay facturas registradas.", M, y);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Mevak · growth.mevakfoodagency.com · Página ${p} de ${pages}`, M, doc.internal.pageSize.getHeight() - 24);
  }

  const safe = String(client.company_name ?? "cliente").replace(/[^\p{L}\p{N}]+/gu, "_");
  doc.save(`Statement_${safe}_${today}.pdf`);
}
