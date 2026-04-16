import { all } from "@/lib/db";
import { formatEUR } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

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
  const items = all<CautelaItemFull>(
    `SELECT ci.*, t.code, t.name, t.brand, t.category, t.type, t.serial_tag
     FROM cautela_items ci
     JOIN tools t ON t.id = ci.tool_id
     WHERE ci.cautela_id = ?`,
    [cautelaId]
  );
  return { cautela, technician, items };
}

export function exportCautelaPDF(cautelaId: string) {
  const data = getCautelaWithItems(cautelaId);
  if (!data) return;
  const { cautela, technician, items } = data;

  const doc = new jsPDF();
  const dateStr = format(new Date(cautela.date_out), "dd/MM/yyyy");

  doc.setFontSize(16);
  doc.text(`Cautela ${cautela.number}`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Date / Data: ${dateStr}`, 14, 26);
  doc.text(`Project / Projeto: ${cautela.project}`, 14, 32);
  doc.text(`Client / Cliente: ${cautela.client || "—"}`, 14, 38);
  doc.text(`Ship / Navio: ${cautela.ship || "—"}`, 14, 44);
  doc.text(`Technician / Técnico: ${technician}`, 14, 50);

  const body = items.map((it) => {
    const total = (it.unit_value_eur || 0) * it.qty_out;
    return [
      it.name,
      it.brand || "—",
      it.category || "—",
      it.type || "—",
      it.serial_tag || "—",
      formatEUR(it.unit_value_eur || 0),
      String(it.qty_out),
      formatEUR(total),
    ];
  });
  const grandTotal = items.reduce(
    (s, it) => s + (it.unit_value_eur || 0) * it.qty_out,
    0
  );

  autoTable(doc, {
    startY: 58,
    head: [
      [
        "Name / Nome",
        "Brand / Marca",
        "Category / Categoria",
        "Type / Tipo",
        "Serial / TAG",
        "Value (€)",
        "Qty",
        "Total (€)",
      ],
    ],
    body,
    foot: [["", "", "", "", "", "", "TOTAL", formatEUR(grandTotal)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
  });

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
    [],
  ];

  const header = [
    "Name / Nome",
    "Brand / Marca",
    "Category / Categoria",
    "Type / Tipo",
    "Serial / TAG",
    "Value (€)",
    "Qty",
    "Total (€)",
  ];
  const rows = items.map((it) => [
    it.name,
    it.brand || "",
    it.category || "",
    it.type || "",
    it.serial_tag || "",
    it.unit_value_eur || 0,
    it.qty_out,
    (it.unit_value_eur || 0) * it.qty_out,
  ]);
  const grandTotal = items.reduce(
    (s, it) => s + (it.unit_value_eur || 0) * it.qty_out,
    0
  );
  rows.push(["", "", "", "", "", "", "TOTAL", grandTotal]);

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
        <td>${escapeHtml(it.name)}</td>
        <td>${escapeHtml(it.brand || "—")}</td>
        <td>${escapeHtml(it.serial_tag || "—")}</td>
        <td style="text-align:right">${formatEUR(it.unit_value_eur || 0)}</td>
        <td style="text-align:right">${it.qty_out}</td>
        <td style="text-align:right">${formatEUR(total)}</td>
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
  @media print { body { padding: 12mm; } }
</style></head><body>
  <h1>Cautela ${escapeHtml(cautela.number)}</h1>
  <div class="meta">
    <div><b>Date / Data:</b> ${dateStr}</div>
    <div><b>Project / Projeto:</b> ${escapeHtml(cautela.project)}</div>
    <div><b>Client / Cliente:</b> ${escapeHtml(cautela.client || "—")}</div>
    <div><b>Ship / Navio:</b> ${escapeHtml(cautela.ship || "—")}</div>
    <div><b>Technician / Técnico:</b> ${escapeHtml(technician)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Name / Nome</th>
        <th>Brand / Marca</th>
        <th>Serial / TAG</th>
        <th style="text-align:right">Value (€)</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Total (€)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr><td colspan="5" style="text-align:right">TOTAL</td><td style="text-align:right">${formatEUR(grandTotal)}</td></tr>
    </tfoot>
  </table>
  <div class="signatures">
    <div class="sig">Technician/Supervisor<br/><i>Técnico/Supervisor</i></div>
    <div class="sig">Delivered by<br/><i>Entregue por</i></div>
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
