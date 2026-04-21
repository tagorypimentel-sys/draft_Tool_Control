import React, { useMemo, useState } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, FileText, LayoutList, ListChecks, History, UserSearch, FilterX, Eye, X } from "lucide-react";
import { all } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import koeLogo from "@/assets/koe-logo.gif";
import { toast } from "sonner";
import { format } from "date-fns";

type Tool = { id: string; code: string; name: string; brand: string | null; category: string | null; quantity: number; value_eur: number | null; tag: string | null; serial_tag: string | null };
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
  
  // Filtros de Inventário
  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("all");
  const [invTag, setInvTag] = useState("");

  // Preview State
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewType, setPreviewType] = useState<"inventory" | "traceability">("inventory");

  const allTools = useMemo(() => { void version; return all<Tool>("SELECT * FROM tools ORDER BY name ASC"); }, [version]);
  const technicians = useMemo(() => { void version; return all<Tech>("SELECT * FROM technicians ORDER BY name ASC"); }, [version]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(allTools.map(t => t.category).filter(Boolean)));
    return cats.sort();
  }, [allTools]);

  const filteredTools = useMemo(() => {
    return allTools.filter(t => {
      const matchSearch = !invSearch || t.name.toLowerCase().includes(invSearch.toLowerCase()) || t.code.toLowerCase().includes(invSearch.toLowerCase());
      const matchCategory = invCategory === "all" || t.category === invCategory;
      const matchTag = !invTag || (t.tag || "").toLowerCase().includes(invTag.toLowerCase());
      return matchSearch && matchCategory && matchTag;
    });
  }, [allTools, invSearch, invCategory, invTag]);

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

  const handlePreviewInventory = (type: "analytic" | "synthetic") => {
    if (!filteredTools.length) return toast.error("No data / Sem dados");
    setPreviewType("inventory");
    setPreviewTitle(type === "analytic" ? "Preview: Inventário Analítico" : "Preview: Inventário Sintético");
    
    if (type === "analytic") {
      setPreviewData(filteredTools);
    } else {
      const summaryMap = filteredTools.reduce((acc, t) => {
        if (!acc[t.name]) acc[t.name] = { name: t.name, quantity: 0, total: 0 };
        acc[t.name].quantity += t.quantity; acc[t.name].total += (t.value_eur || 0) * t.quantity;
        return acc;
      }, {} as any);
      setPreviewData(Object.values(summaryMap));
    }
    // Scroll to preview
    setTimeout(() => document.getElementById("report-preview")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handlePreviewTraceability = (target: "item" | "tech") => {
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

    const entityName = target === "item" ? allTools.find(t => t.id === id)?.name : technicians.find(t => t.id === id)?.name;
    setPreviewType("traceability");
    setPreviewTitle(`Preview: ${entityName}`);
    setPreviewData(data);
    setTimeout(() => document.getElementById("report-preview")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const exportInventory = async (type: "analytic" | "synthetic", exportFormat: "excel" | "pdf") => {
    if (!filteredTools.length) return toast.error("No data / Sem dados");
    
    if (exportFormat === "excel") {
      let rows: any[] = [];
      if (type === "analytic") {
        rows = filteredTools.map(t => ({
          Code: t.code, Name: t.name, Brand: t.brand || "", Category: t.category || "", TAG: t.tag || "", Serial: t.serial_tag || "", 
          Qty: t.quantity, "Unit (€)": t.value_eur || 0, "Total (€)": (t.value_eur || 0) * t.quantity
        }));
      } else {
        const summaryMap = filteredTools.reduce((acc, t) => {
          if (!acc[t.name]) acc[t.name] = { Name: t.name, Qty: 0, Total: 0 };
          acc[t.name].Qty += t.quantity; acc[t.name].Total += (t.value_eur || 0) * t.quantity;
          return acc;
        }, {} as any);
        rows = Object.values(summaryMap).map((s: any) => ({ "Nome / Name": s.Name, "Qtd / Qty": s.Qty, "Total (€)": s.Total }));
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
        head = [["Code", "Name", "Brand", "Category", "TAG", "Serial", "Qty", "Unit", "Total"]];
        body = filteredTools.map(t => [t.code, t.name, t.brand, t.category, t.tag, t.serial_tag, t.quantity, fmtEUR(t.value_eur || 0), fmtEUR((t.value_eur || 0) * t.quantity)]);
      } else {
        head = [["Nome / Name", "Qtd / Qty", "Total (€)"]];
        const summaryMap = filteredTools.reduce((acc, t) => {
          if (!acc[t.name]) acc[t.name] = { Name: t.name, Qty: 0, Total: 0 };
          acc[t.name].Qty += t.quantity; acc[t.name].Total += (t.value_eur || 0) * t.quantity;
          return acc;
        }, {} as any);
        body = Object.values(summaryMap).map((s: any) => [s.Name, s.Qty, fmtEUR(s.Total)]);
      }

      autoTable(doc, { head, body, startY: 30, didDrawPage: drawHeader, headStyles: { fillColor: [37, 99, 235] }, styles: { fontSize: 8 } });
      doc.save(`inventory_${type}.pdf`);
    }
  };

  const exportTraceability = async (target: "item" | "tech", exportFormat: "excel" | "pdf") => {
    const id = target === "item" ? selectedToolId : selectedTechId;
    if (!id) return toast.error("Select target / Selecione o destino");
    const sql = target === "item" 
      ? `SELECT c.number as cautela_num, c.project, t.name as tech_name, c.date_out, ci.qty_out, ci.qty_returned, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN technicians t ON t.id = c.technician_id WHERE ci.tool_id = ? ORDER BY c.date_out DESC`
      : `SELECT c.number as cautela_num, c.project, tl.name as tool_name, tl.code as tool_code, c.date_out, ci.qty_out, ci.qty_returned, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN tools tl ON tl.id = ci.tool_id WHERE c.technician_id = ? ORDER BY c.date_out DESC`;
    const data = all<MovementRow>(sql, [id]);
    if (!data.length) return toast.error("No data");

    if (exportFormat === "excel") {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Traceability");
      XLSX.writeFile(wb, `traceability_${target}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: "landscape" });
      const head = [[ "Cautela #", "Project", target === "item" ? "Technician" : "Tool", "Date", "Qty", "Returned", "Status" ]];
      const body = data.map(d => [d.cautela_num, d.project, target === "item" ? d.tech_name : `${d.tool_code} - ${d.tool_name}`, format(new Date(d.date_out), "dd/MM/yyyy"), d.qty_out, d.qty_returned, d.status]);
      autoTable(doc, { head, body, startY: 20, headStyles: { fillColor: [37, 99, 235] } });
      doc.save(`traceability_${target}.pdf`);
    }
  };

  const clearFilters = () => { setInvSearch(""); setInvCategory("all"); setInvTag(""); };

  return (
    <div className="space-y-6 pb-20">
      <BiLabel en="Reports" pt="Relatórios" />
      
      {/* Seção 1: Inventários */}
      <Card className="p-6 border-l-4 border-l-blue-600 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LayoutList className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-lg">Exportação de Inventário</h3>
          </div>
          {(invSearch || invCategory !== "all" || invTag) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive">
              <FilterX className="mr-1 h-3 w-3" /> Limpar Filtros
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome ou Código</Label><Input placeholder="Search..." value={invSearch} onChange={e => setInvSearch(e.target.value)} className="bg-white" /></div>
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Categoria</Label><Select value={invCategory} onValueChange={setInvCategory}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas / All</SelectItem>{categories.map(c => <SelectItem key={c} value={c || ""}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">TAG</Label><Input placeholder="TAG search..." value={invTag} onChange={e => setInvTag(e.target.value)} className="bg-white" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 bg-white border-t-2 border-t-blue-600 space-y-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="font-bold text-sm">Analítico / Analytic</span><span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{filteredTools.length} itens</span></div>
            <div className="flex gap-2">
              <Button className="flex-1 h-8 text-xs" variant="ghost" onClick={() => handlePreviewInventory("analytic")}><Eye className="mr-1 h-3.5 w-3.5" />Visualizar</Button>
              <Button className="flex-1 h-8 text-xs" variant="outline" onClick={() => exportInventory("analytic", "excel")}><FileSpreadsheet className="mr-1 h-3.5 w-3.5" />Excel</Button>
              <Button className="flex-1 h-8 text-xs" variant="outline" onClick={() => exportInventory("analytic", "pdf")}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button>
            </div>
          </Card>
          <Card className="p-4 bg-white border-t-2 border-t-sky-600 space-y-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="font-bold text-sm">Sintético / Synthetic</span><span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">Resumo</span></div>
            <div className="flex gap-2">
              <Button className="flex-1 h-8 text-xs" variant="ghost" onClick={() => handlePreviewInventory("synthetic")}><Eye className="mr-1 h-3.5 w-3.5" />Visualizar</Button>
              <Button className="flex-1 h-8 text-xs" variant="outline" onClick={() => exportInventory("synthetic", "excel")}><FileSpreadsheet className="mr-1 h-3.5 w-3.5" />Excel</Button>
              <Button className="flex-1 h-8 text-xs" variant="outline" onClick={() => exportInventory("synthetic", "pdf")}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button>
            </div>
          </Card>
        </div>
      </Card>

      {/* Seção 2: Rastreabilidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4 border-t-4 border-t-green-600 shadow-md">
          <div className="flex items-center gap-3"><History className="h-6 w-6 text-green-600" /><h3 className="font-bold text-lg">Rastreabilidade por Item</h3></div>
          <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase font-bold text-green-700">Ferramenta / Tool</Label><Select value={selectedToolId} onValueChange={setSelectedToolId}><SelectTrigger className="bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{allTools.map(t => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name} {t.tag ? `(${t.tag})` : ""}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 text-xs" variant="ghost" onClick={() => handlePreviewTraceability("item")}><Eye className="mr-2 h-4 w-4" />Visualizar</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-xs" onClick={() => exportTraceability("item", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-xs" onClick={() => exportTraceability("item", "pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </Card>
        <Card className="p-6 space-y-4 border-t-4 border-t-purple-600 shadow-md">
          <div className="flex items-center gap-3"><UserSearch className="h-6 w-6 text-purple-600" /><h3 className="font-bold text-lg">Histórico por Técnico</h3></div>
          <div className="space-y-2"><Label className="text-xs text-muted-foreground uppercase font-bold text-purple-700">Técnico / Technician</Label><Select value={selectedTechId} onValueChange={setSelectedTechId}><SelectTrigger className="bg-slate-50"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 text-xs" variant="ghost" onClick={() => handlePreviewTraceability("tech")}><Eye className="mr-2 h-4 w-4" />Visualizar</Button>
            <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs" onClick={() => exportTraceability("tech", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs" onClick={() => exportTraceability("tech", "pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </Card>
      </div>

      {/* SEÇÃO DE PREVIEW DINÂMICO */}
      {previewData && (
        <Card id="report-preview" className="mt-8 border-2 border-slate-200 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3"><Eye className="h-5 w-5 text-blue-400" /><h3 className="font-bold">{previewTitle}</h3></div>
            <Button variant="ghost" size="icon" onClick={() => setPreviewData(null)} className="text-white hover:bg-white/20"><X className="h-5 w-5" /></Button>
          </div>
          <div className="p-0 max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-100 z-10">
                <TableRow>
                  {previewType === "inventory" ? (
                    previewTitle.includes("Analítico") ? (
                      <>
                        <TableHead className="font-bold">Código</TableHead>
                        <TableHead className="font-bold">Nome</TableHead>
                        <TableHead className="font-bold">TAG</TableHead>
                        <TableHead className="font-bold">Qtd</TableHead>
                        <TableHead className="font-bold">Total (€)</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="font-bold">Nome</TableHead>
                        <TableHead className="font-bold">Qtd Total</TableHead>
                        <TableHead className="font-bold">Valor Total (€)</TableHead>
                      </>
                    )
                  ) : (
                    <>
                      <TableHead className="font-bold">Cautela #</TableHead>
                      <TableHead className="font-bold">Projeto</TableHead>
                      <TableHead className="font-bold">{previewTitle.includes("Histórico") ? "Ferramenta" : "Técnico"}</TableHead>
                      <TableHead className="font-bold">Data</TableHead>
                      <TableHead className="font-bold">Qtd</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, i) => (
                  <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                    {previewType === "inventory" ? (
                      previewTitle.includes("Analítico") ? (
                        <>
                          <TableCell className="font-mono text-xs">{row.code}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.tag || "—"}</TableCell>
                          <TableCell>{row.quantity}</TableCell>
                          <TableCell className="font-semibold">{fmtEUR((row.value_eur || 0) * row.quantity)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.quantity}</TableCell>
                          <TableCell className="font-semibold">{fmtEUR(row.total)}</TableCell>
                        </>
                      )
                    ) : (
                      <>
                        <TableCell className="font-mono font-bold text-blue-600">{row.cautela_num}</TableCell>
                        <TableCell>{row.project}</TableCell>
                        <TableCell>{row.tech_name || `${row.tool_code} - ${row.tool_name}`}</TableCell>
                        <TableCell className="text-xs">{format(new Date(row.date_out), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{row.qty_out}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${row.status === 'open' ? 'bg-amber-100 text-amber-700' : row.status === 'closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                            {row.status.toUpperCase()}
                          </span>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="bg-slate-50 p-3 text-[10px] text-muted-foreground italic text-center border-t">
            Exibindo {previewData.length} resultados encontrados.
          </div>
        </Card>
      )}
    </div>
  );
};

export default Reports;
