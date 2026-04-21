import { all } from "@/lib/db";
import { formatEUR } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import koeLogo from "@/assets/koe-logo.gif";

function loadImageAsDataURL(src: string): Promise<{ dataUrl: string; ratio: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        ratio: img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1,
      });
    };
    img.onerror = reject;
    img.src = src;
  });
}

export type CautelaRow = {
  id: string;
  number: string;
  project: string;
  client: string | null;
  ship: string | null;
  technician_id: string;
  date_out: string;
  date_in: string | null;
  status: string;
  notes: string | null;
  delivered_by: string | null;
};

export type CautelaItemFull = {
  id: string;
  cautela_id: string;
  tool_id: string;
  qty_out: number;
  qty_returned: number;
  qty_out_of_service: number;
  condition_notes: string | null;
  unit_value_eur: number | null;
  // joined
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  type: string | null;
  serial_tag: string | null;
};

export function normalizeProjectPrefix(project: string): string {
  return project
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function generateCautelaNumber(project: string): string {
  const prefix = normalizeProjectPrefix(project) || "PROJ";
  const rows = all<{ c: number }>(
    "SELECT COUNT(*) as c FROM cautelas WHERE number LIKE ?",
    [`${prefix}_%`]
  );
  const next = (rows[0]?.c ?? 0) + 1;
  return `${prefix}_${String(next).padStart(2, "0")}`;
}

export function getCautelaWithItems(cautelaId: string) {
  const cautela = all<CautelaRow>("SELECT * FROM cautelas WHERE id=?", [cautelaId])[0];
  if (!cautela) return null;
  const technician =
    all<{ name: string }>("SELECT name FROM technicians WHERE id=?", [
      cautela.technician_id,
    ])[0]?.name || "—";
  const items = all<CautelaItemFull & { tag: string | null }>(
    `SELECT ci.*, t.code, t.name, t.brand, t.category, t.type, t.serial_tag, t.tag
     FROM cautela_items ci
     JOIN tools t ON t.id = ci.tool_id
     WHERE ci.cautela_id = ?`,
    [cautelaId]
  );
  return { cautela, technician, items };
}

export async function exportCautelaPDF(cautelaId: string) {
  const data = getCautelaWithItems(cautelaId);
  if (!data) return;
  const { cautela, technician, items } = data;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStr = format(new Date(cautela.date_out), "dd/MM/yyyy");

  let logo: { dataUrl: string; ratio: number } | null = null;
  try { logo = await loadImageAsDataURL(koeLogo); } catch { /* noop */ }

  const drawHeaderFooter = () => {
    const logoH = 14;
    const logoW = logo ? logoH * logo.ratio : 0;
    if (logo) {
      try { doc.addImage(logo.dataUrl, "PNG", 14, 8, logoW, logoH); } catch { /* noop */ }
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.text("KOE Draft Tool Control", 14 + logoW + 4, 13);
    
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235); // Blue color for highlights
    doc.text(`Cautela ${cautela.number}`, 14 + logoW + 4, 20);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(14, 25, pageWidth - 14, 25);

    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(100);
    const pageNum = doc.getNumberOfPages();
    doc.text(`Page ${pageNum} / Página ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: "center" });
    doc.text("KOE Draft Tool Control", pageWidth - 14, pageHeight - 6, { align: "right" });
  };

  // Manually draw header for first page (autoTable's didDrawPage will handle subsequent ones too,
  // but we need meta info just on the first page below the header).
  drawHeaderFooter();
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Date / Data: ${dateStr}`, 14, 32);
  doc.text(`Project / Projeto: ${cautela.project}`, 14, 38);
  doc.text(`Client / Cliente: ${cautela.client || "—"}`, 14, 44);
  doc.text(`Ship / Navio: ${cautela.ship || "—"}`, 14, 50);
  doc.text(`Technician / Técnico: ${technician}`, 14, 56);
  doc.text(`Delivered by / Responsável pela Entrega: ${cautela.delivered_by || "—"}`, 14, 62);

  const body = items.map((it) => {
    const total = (it.unit_value_eur || 0) * it.qty_out;
    return [
      String(it.qty_out),
      it.name,
      it.brand || "—",
      it.serial_tag || "—",
      it.tag || "—",
      formatEUR(total),
    ];
  });
  const grandTotal = items.reduce(
    (s, it) => s + (it.unit_value_eur || 0) * it.qty_out,
    0
  );

  let firstPage = true;
  autoTable(doc, {
    startY: 70,
    margin: { top: 28, bottom: 16, left: 14, right: 14 },
    head: [
      [
        "Qty / Qtd",
        "Name / Nome",
        "Brand / Marca",
        "Serial",
        "TAG",
        "Total (€)",
      ],
    ],
    body,
    foot: [["", "", "", "", "TOTAL", formatEUR(grandTotal)]],
    styles: { fontSize: 8, halign: "left" },
    headStyles: { fillColor: [37, 99, 235], halign: "left" },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold", halign: "left" },
    didDrawPage: () => {
      if (firstPage) { firstPage = false; return; }
      drawHeaderFooter();
    },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth / 2 - 40, pageHeight - 10, 80, 6, "F");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Page ${i} of ${total} / Página ${i} de ${total}`, pageWidth / 2, pageHeight - 6, { align: "center" });
    doc.text("KOE Draft Tool Control", pageWidth - 14, pageHeight - 6, { align: "right" });
    
    // Signature lines on the last page
    if (i === total) {
      const sigY = pageHeight - 35;
      doc.setDrawColor(0);
      doc.line(14, sigY, 90, sigY);
      doc.line(pageWidth - 90, sigY, pageWidth - 14, sigY);
      
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(technician, 14, sigY + 4);
      doc.text("Technician / Técnico", 14, sigY + 8);
      
      doc.text(cautela.delivered_by || "—", pageWidth - 14, sigY + 4, { align: "right" });
      doc.text("Delivered by / Entregue por", pageWidth - 14, sigY + 8, { align: "right" });
    }
  }

  doc.save(`Cautela_${cautela.number}.pdf`);
}

export function exportCautelaExcel(cautelaId: string) {
  const data = getCautelaWithItems(cautelaId);
  if (!data) return;
  const { cautela, technician, items } = data;

  const meta = [
    ["Cautela", cautela.number],
    ["Date / Data", format(new Date(cautela.date_out), "dd/MM/yyyy")],
    ["Project / Projeto", cautela.project],
    ["Client / Cliente", cautela.client || ""],
    ["Ship / Navio", cautela.ship || ""],
    ["Technician / Técnico", technician],
    ["Delivered by / Responsável pela Entrega", cautela.delivered_by || ""],
    [],
  ];

  const header = [
    "Qty / Qtd",
    "Name / Nome",
    "Brand / Marca",
    "Serial",
    "TAG",
    "Total (€)",
  ];
  const rows: (string | number)[][] = items.map((it) => [
    it.qty_out,
    it.name,
    it.brand || "",
    it.serial_tag || "",
    it.tag || "",
    (it.unit_value_eur || 0) * it.qty_out,
  ]);
  const grandTotal = items.reduce(
    (s, it) => s + (it.unit_value_eur || 0) * it.qty_out,
    0
  );
  rows.push(["", "", "", "", "TOTAL", grandTotal]);

  const aoa = [...meta, header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cautela");
  XLSX.writeFile(wb, `Cautela_${cautela.number}.xlsx`);
}

export function printCautela(cautelaId: string) {
  const data = getCautelaWithItems(cautelaId);
  if (!data) return;
  const { cautela, technician, items } = data;
  const dateStr = format(new Date(cautela.date_out), "dd/MM/yyyy");

  const grandTotal = items.reduce(
    (s, it) => s + (it.unit_value_eur || 0) * it.qty_out,
    0
  );

  const rowsHtml = items
    .map((it) => {
      const total = (it.unit_value_eur || 0) * it.qty_out;
      return `<tr>
        <td style="text-align:left">${it.qty_out}</td>
        <td>${escapeHtml(it.name)}</td>
        <td>${escapeHtml(it.brand || "—")}</td>
        <td>${escapeHtml(it.serial_tag || "—")}</td>
        <td>${escapeHtml(it.tag || "—")}</td>
        <td style="text-align:left">${formatEUR(total)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>Cautela ${cautela.number}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .meta { font-size: 12px; margin-bottom: 16px; }
  .meta div { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #eef2ff; }
  tfoot td { font-weight: bold; background: #f1f5f9; }
  .signatures { display: flex; gap: 40px; margin-top: 60px; font-size: 12px; }
  .sig { flex: 1; border-top: 1px solid #111; padding-top: 6px; text-align: center; }
  .sig .name { font-weight: bold; margin-bottom: 4px; }
  @media print { body { padding: 12mm; } }
</style></head><body>
  <header style="display:flex;align-items:center;gap:12px;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:12px;">
    <img src="${koeLogo}" alt="KOE" style="height:48px;width:auto;" />
    <div>
      <h1 style="margin:0;font-size:18px;">KOE Draft Tool Control</h1>
      <div style="font-size:13px;color:#555;">Cautela ${escapeHtml(cautela.number)}</div>
    </div>
  </header>
  <div class="meta">
    <div><b>Date / Data:</b> ${dateStr}</div>
    <div><b>Project / Projeto:</b> ${escapeHtml(cautela.project)}</div>
    <div><b>Client / Cliente:</b> ${escapeHtml(cautela.client || "—")}</div>
    <div><b>Ship / Navio:</b> ${escapeHtml(cautela.ship || "—")}</div>
    <div><b>Technician / Técnico:</b> ${escapeHtml(technician)}</div>
    <div><b>Delivered by / Responsável pela Entrega:</b> ${escapeHtml(cautela.delivered_by || "—")}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Qty / Qtd</th>
        <th>Name / Nome</th>
        <th>Brand / Marca</th>
        <th>Serial</th>
        <th>TAG</th>
        <th style="text-align:left">Total (€)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr><td colspan="5" style="text-align:left">TOTAL</td><td style="text-align:left">${formatEUR(grandTotal)}</td></tr>
    </tfoot>
  </table>
  <div class="signatures">
    <div class="sig">
      <div class="name">${escapeHtml(technician)}</div>
      Technician/Supervisor<br/><i>Técnico/Supervisor</i>
    </div>
    <div class="sig">
      <div class="name">${escapeHtml(cautela.delivered_by || "—")}</div>
      Delivered by<br/><i>Responsável pela Entrega</i>
    </div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
