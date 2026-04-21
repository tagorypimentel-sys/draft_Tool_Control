import { useMemo, useState } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, LayoutList, ListChecks, History, UserSearch, Search } from "lucide-react";
import { all } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import koeLogo from "@/assets/koe-logo.gif";
import { toast } from "sonner";
import { format } from "date-fns";

type Tool = { id: string; code: string; name: string; brand: string | null; quantity: number; value_eur: number | null; tag: string | null; serial_tag: string | null };
type Tech = { id: string; name: string };
type MovementRow = { 
  cautela_num: string; 
  project: string; 
  tech_name: string; 
  date_out: string; 
  qty_out: number; 
  qty_returned: number; 
  status: string;
  tool_name?: string;
  tool_code?: string;
};

const Reports = () => {
  const { version } = useDb();
  const [selectedToolId, setSelectedToolId] = useState<string>("");
  const [selectedTechId, setSelectedTechId] = useState<string>("");

  const tools = useMemo(() => { void version; return all<Tool>("SELECT * FROM tools ORDER BY name ASC"); }, [version]);
  const technicians = useMemo(() => { void version; return all<Tech>("SELECT * FROM technicians ORDER BY name ASC"); }, [version]);

  const loadImageAsDataURL = (src: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context unavailable"));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject; img.src = src;
    });

  const fmtEUR = (v: number) => `€ ${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportInventory = async (type: "analytic" | "synthetic", format: "excel" | "pdf") => {
    if (!tools.length) return toast.error("No data / Sem dados");
    
    if (format === "excel") {
      let rows: any[] = [];
      if (type === "analytic") {
        rows = tools.map(t => ({
          Code: t.code, Name: t.name, Brand: t.brand || "", TAG: t.tag || "", Serial: t.serial_tag || "", 
          Qty: t.quantity, "Unit (€)": t.value_eur || 0, "Total (€)": (t.value_eur || 0) * t.quantity
        }));
      } else {
        const summary = tools.reduce((acc, t) => {
          if (!acc[t.name]) acc[t.name] = { Name: t.name, Qty: 0, Total: 0 };
          acc[t.name].Qty += t.quantity; acc[t.name].Total += (t.value_eur || 0) * t.quantity;
          return acc;
        }, {} as any);
        rows = Object.values(summary).map((s: any) => ({ "Nome / Name": s.Name, "Qtd / Qty": s.Qty, "Total (€)": s.Total }));
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");
      XLSX.writeFile(wb, `inventory_${type}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: "landscape" });
      let logoData = ""; try { logoData = await loadImageAsDataURL(koeLogo); } catch { }
      const drawHeader = () => {
        if (logoData) doc.addImage(logoData, "PNG", 10, 5, 25, 14);
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(type === "analytic" ? "Inventário Analítico" : "Inventário Sintético", 40, 12);
        doc.setFontSize(10); doc.setFont("helvetica", "italic");
        doc.text(type === "analytic" ? "Analytic Inventory" : "Synthetic Inventory", 40, 18);
      };
      
      let head: string[][] = [];
      let body: any[][] = [];
      if (type === "analytic") {
        head = [["Code", "Name", "Brand", "TAG", "Serial", "Qty", "Unit", "Total"]];
        body = tools.map(t => [t.code, t.name, t.brand, t.tag, t.serial_tag, t.quantity, fmtEUR(t.value_eur || 0), fmtEUR((t.value_eur || 0) * t.quantity)]);
      } else {
        head = [["Nome / Name", "Qtd / Qty", "Total (€)"]];
        const summary = tools.reduce((acc, t) => {
          if (!acc[t.name]) acc[t.name] = { Name: t.name, Qty: 0, Total: 0 };
          acc[t.name].Qty += t.quantity; acc[t.name].Total += (t.value_eur || 0) * t.quantity;
          return acc;
        }, {} as any);
        body = Object.values(summary).map((s: any) => [s.Name, s.Qty, fmtEUR(s.Total)]);
      }

      autoTable(doc, { head, body, startY: 28, didDrawPage: drawHeader, headStyles: { fillColor: [37, 99, 235] }, styles: { fontSize: 8 } });
      doc.save(`inventory_${type}.pdf`);
    }
  };

  const exportTraceability = async (target: "item" | "tech", format: "excel" | "pdf") => {
    const id = target === "item" ? selectedToolId : selectedTechId;
    if (!id) return toast.error(target === "item" ? "Select a tool / Selecione uma ferramenta" : "Select a technician / Selecione um técnico");

    const sql = target === "item" 
      ? `SELECT c.number as cautela_num, c.project, t.name as tech_name, c.date_out, ci.qty_out, ci.qty_returned, c.status
         FROM cautela_items ci
         JOIN cautelas c ON c.id = ci.cautela_id
         JOIN technicians t ON t.id = c.technician_id
         WHERE ci.tool_id = ? ORDER BY c.date_out DESC`
      : `SELECT c.number as cautela_num, c.project, tl.name as tool_name, tl.code as tool_code, c.date_out, ci.qty_out, ci.qty_returned, c.status
         FROM cautela_items ci
         JOIN cautelas c ON c.id = ci.cautela_id
         JOIN tools tl ON tl.id = ci.tool_id
         WHERE c.technician_id = ? ORDER BY c.date_out DESC`;

    const data = all<MovementRow>(sql, [id]);
    if (!data.length) return toast.error("No movements found / Sem movimentações encontradas");

    const name = target === "item" ? tools.find(t => t.id === id)?.name : technicians.find(t => t.id === id)?.name;

    if (format === "excel") {
      const rows = data.map(d => ({
        "Cautela #": d.cautela_num, Project: d.project, [target === "item" ? "Technician" : "Tool"]: target === "item" ? d.tech_name : `${d.tool_code} - ${d.tool_name}`,
        Date: format(new Date(d.date_out), "dd/MM/yyyy"), Qty: d.qty_out, Returned: d.qty_returned, Status: d.status
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Traceability");
      XLSX.writeFile(wb, `traceability_${target}_${id.slice(0, 5)}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: "landscape" });
      let logoData = ""; try { logoData = await loadImageAsDataURL(koeLogo); } catch { }
      const drawHeader = () => {
        if (logoData) doc.addImage(logoData, "PNG", 10, 5, 25, 14);
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(target === "item" ? `Rastreabilidade: ${name}` : `Histórico do Técnico: ${name}`, 40, 12);
        doc.setFontSize(10); doc.setFont("helvetica", "italic");
        doc.text(target === "item" ? "Item Traceability" : "Technician History", 40, 18);
      };
      
      const head = [[ "Cautela #", "Project", target === "item" ? "Technician" : "Tool", "Date", "Qty", "Returned", "Status" ]];
      const body = data.map(d => [
        d.cautela_num, d.project, target === "item" ? d.tech_name : `${d.tool_code} - ${d.tool_name}`,
        format(new Date(d.date_out), "dd/MM/yyyy"), d.qty_out, d.qty_returned, d.status
      ]);

      autoTable(doc, { head, body, startY: 28, didDrawPage: drawHeader, headStyles: { fillColor: target === "item" ? [22, 163, 74] : [147, 51, 234] }, styles: { fontSize: 8 } });
      doc.save(`traceability_${target}.pdf`);
    }
  };

  return (
    <div className="space-y-6">
      <BiLabel en="Reports" pt="Relatórios" />
      
      {/* Seção 1: Inventários */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4 border-t-4 border-t-blue-600">
          <div className="flex items-center gap-3">
            <LayoutList className="h-6 w-6 text-blue-600" />
            <h3 className="font-bold text-lg">Inventário Analítico</h3>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => exportInventory("analytic", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button className="flex-1" variant="outline" onClick={() => exportInventory("analytic", "pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </Card>
        <Card className="p-6 space-y-4 border-t-4 border-t-sky-600">
          <div className="flex items-center gap-3">
            <ListChecks className="h-6 w-6 text-sky-600" />
            <h3 className="font-bold text-lg">Inventário Sintético</h3>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => exportInventory("synthetic", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button className="flex-1" variant="outline" onClick={() => exportInventory("synthetic", "pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </Card>
      </div>

      {/* Seção 2: Rastreabilidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rastreabilidade por Item */}
        <Card className="p-6 space-y-4 border-t-4 border-t-green-600">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-green-600" />
            <h3 className="font-bold text-lg">Rastreabilidade por Item</h3>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase font-bold">Ferramenta / Tool</Label>
            <Select value={selectedToolId} onValueChange={setSelectedToolId}>
              <SelectTrigger><SelectValue placeholder="Select tool / Selecione..." /></SelectTrigger>
              <SelectContent>
                {tools.map(t => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name} {t.tag ? `(${t.tag})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => exportTraceability("item", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => exportTraceability("item", "pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </Card>

        {/* Rastreabilidade por Técnico */}
        <Card className="p-6 space-y-4 border-t-4 border-t-purple-600">
          <div className="flex items-center gap-3">
            <UserSearch className="h-6 w-6 text-purple-600" />
            <h3 className="font-bold text-lg">Histórico por Técnico</h3>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase font-bold">Técnico / Technician</Label>
            <Select value={selectedTechId} onValueChange={setSelectedTechId}>
              <SelectTrigger><SelectValue placeholder="Select technician / Selecione..." /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => exportTraceability("tech", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => exportTraceability("tech", "pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>
);

export default Reports;
