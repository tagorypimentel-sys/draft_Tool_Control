import React, { useMemo, useState } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText, LayoutList, History, UserSearch, Eye, X, Search, Download } from "lucide-react";
import { all } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import koeLogo from "@/assets/koe-logo.gif";
import { toast } from "sonner";
import { format } from "date-fns";

const Reports = () => {
  const { version } = useDb();
  
  // States para Inventário (Filtros removidos conforme pedido)
  // const [invSearch, setInvSearch] = useState("");
  // const [invCategory, setInvCategory] = useState("all");
  // const [invTag, setInvTag] = useState("");

  // States para Rastreabilidade por Item
  const [selectedToolId, setSelectedToolId] = useState("");
  const [traceSearch, setTraceSearch] = useState("");
  const [traceType, setTraceType] = useState("all");
  const [traceTag, setTraceTag] = useState("");

  // State para Técnico
  const [selectedTechId, setSelectedTechId] = useState("");

  // Preview State
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

  const allTools = useMemo(() => { 
    void version; 
    return all<any>(`
      SELECT t.*, 
      COALESCE((
        SELECT SUM(ci.qty_out - ci.qty_returned)
        FROM cautela_items ci
        JOIN cautelas c ON c.id = ci.cautela_id
        WHERE ci.tool_id = t.id AND c.status = 'open'
      ), 0) as qty_out_now,
      (t.quantity - COALESCE((
        SELECT SUM(ci.qty_out - ci.qty_returned)
        FROM cautela_items ci
        JOIN cautelas c ON c.id = ci.cautela_id
        WHERE ci.tool_id = t.id AND c.status = 'open'
      ), 0)) as available_qty
      FROM tools t 
      ORDER BY t.name ASC
    `); 
  }, [version]);

  const technicians = useMemo(() => { void version; return all<any>("SELECT * FROM technicians ORDER BY name ASC"); }, [version]);

  const categories = useMemo(() => {
    return Array.from(new Set(allTools.map(t => t.category).filter(Boolean))).sort() as string[];
  }, [allTools]);

  const types = useMemo(() => {
    return Array.from(new Set(allTools.map(t => t.type).filter(Boolean))).sort() as string[];
  }, [allTools]);

  const filteredInvTools = allTools; // Filtros desativados conforme solicitado

  const filteredTraceTools = useMemo(() => {
    return allTools.filter(t => {
      const mS = !traceSearch || t.name.toLowerCase().includes(traceSearch.toLowerCase()) || t.code.toLowerCase().includes(traceSearch.toLowerCase());
      const mTp = traceType === "all" || t.type === traceType;
      const mT = !traceTag || (t.tag || "").toLowerCase().includes(traceTag.toLowerCase());
      return mS && mTp && mT;
    });
  }, [allTools, traceSearch, traceType, traceTag]);

  const fmtEUR = (v: number) => `€ ${v.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;

  const loadImageAsDataURL = (src: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context unavailable"));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });

  const getInventoryData = (type: "analytic" | "synthetic") => {
    const tools = allTools;
    if (type === "analytic") {
      const headers = ["Código", "Ferramenta", "TAG", "Total", "Emp.", "Disp."];
      const pdfData = tools.map(t => ({ 
        c1: t.code, 
        c2: t.name, 
        c3: t.tag || "—", 
        c4: String(t.quantity), 
        c5: String(t.qty_out_now),
        c6: String(t.available_qty)
      }));
      const excelData = tools.map(t => ({ 
        "Código": t.code, 
        "Ferramenta": t.name, 
        "TAG": t.tag || "—", 
        "Total Geral": t.quantity,
        "Emprestado": t.qty_out_now,
        "Disponível": t.available_qty
      }));
      return { headers, pdfData, excelData, title: "Inventário Analítico" };
    } else {
      const headers = ["Item", "Total", "Emprestado", "Disponível", "Valor Total"];
      const summary = tools.reduce((acc, t) => {
        const tType = t.type || "Sem Tipo";
        if (!acc[tType]) acc[tType] = {};
        if (!acc[tType][t.name]) acc[tType][t.name] = { name: t.name, total: 0, out: 0, avail: 0, value: 0 };
        const qty = Number(t.quantity) || 0;
        const val = Number(t.value_eur) || 0;
        const out = Number(t.qty_out_now) || 0;
        const avail = Number(t.available_qty) || 0;

        acc[tType][t.name].total += qty; 
        acc[tType][t.name].out += out; 
        acc[tType][t.name].avail += avail; 
        acc[tType][t.name].value += val * qty;
        return acc;
      }, {} as any);

      const rows: any[] = [];
      let grandQty = 0, grandOut = 0, grandAvail = 0, grandValue = 0;

      Object.keys(summary).sort().forEach(tType => {
        let typeQty = 0, typeOut = 0, typeAvail = 0, typeValue = 0;
        
        // Header for Type
        rows.push({ c1: `TIPO: ${tType}`, isGroup: true });

        const items = Object.values(summary[tType]).sort((a: any, b: any) => a.name.localeCompare(b.name));
        items.forEach((s: any) => {
          rows.push({ 
            c1: s.name, 
            c2: String(s.total), 
            c3: String(s.out), 
            c4: String(s.avail), 
            c5: fmtEUR(s.value) 
          });
          typeQty += s.total; typeOut += s.out; typeAvail += s.avail; typeValue += s.value;
        });

        // Subtotal for Type
        rows.push({ 
          c1: `Sub-total ${tType}`, 
          c2: String(typeQty), 
          c3: String(typeOut), 
          c4: String(typeAvail), 
          c5: fmtEUR(typeValue),
          isSubtotal: true
        });

        grandQty += typeQty; grandOut += typeOut; grandAvail += typeAvail; grandValue += typeValue;
      });

      // Grand Total
      rows.push({ 
        c1: "TOTAL GERAL", 
        c2: String(grandQty), 
        c3: String(grandOut), 
        c4: String(grandAvail), 
        c5: fmtEUR(grandValue),
        isTotal: true
      });

      const excelData = rows.filter(r => !r.isGroup).map(r => ({
        "Item": r.c1,
        "Total": r.c2,
        "Emprestado": r.c3,
        "Disponível": r.c4,
        "Valor Total": r.c5
      }));

      return { headers, pdfData: rows, excelData, title: "Inventário Sintético" };
    }
  };

  const handleActionInventory = (type: "analytic" | "synthetic", action: "view" | "excel" | "pdf") => {
    if (!allTools.length) return toast.error("Sem dados no inventário");
    const { headers, pdfData, excelData, title } = getInventoryData(type);
    
    if (action === "view") {
      setPreviewTitle(title);
      setPreviewHeaders(headers);
      setPreviewData(pdfData);
    } else if (action === "excel") {
      exportExcel(excelData, title.toLowerCase().replace(/ /g, "_"));
      toast.success(`${title} exportado para Excel`);
    } else if (action === "pdf") {
      generatePDF(title, headers, pdfData);
    }
  };

  const handlePreviewTraceability = (target: "item" | "tech") => {
    const id = target === "item" ? selectedToolId : selectedTechId;
    if (!id || id === "_") return toast.error("Selecione um item ou técnico");
    
    const sql = target === "item" 
      ? `SELECT c.number, c.project, t.name as tech, c.date_out, c.date_in, ci.qty_out, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN technicians t ON t.id = c.technician_id WHERE ci.tool_id = ? ORDER BY c.date_out DESC`
      : `SELECT c.number, c.project, tl.name as tool, c.date_out, c.date_in, ci.qty_out, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN tools tl ON tl.id = ci.tool_id WHERE c.technician_id = ? ORDER BY c.date_out DESC`;
    
    const data = all<any>(sql, [id]);
    if (!data.length) return toast.error("Sem movimentações");
    
    setPreviewTitle(target === "item" ? "Rastreabilidade de Item" : "Histórico de Técnico");
    setPreviewHeaders(["NR do Cautela", "NR do Projeto", target === "item" ? "Técnico" : "Ferramenta", "Data de Retirada", "Data de Devolução", "Status"]);
    setPreviewData(data.map(d => ({ 
      c1: d.number, 
      c2: d.project, 
      c3: d.tech || d.tool, 
      c4: d.date_out ? format(new Date(d.date_out), "dd/MM/yyyy") : "—", 
      c5: d.date_in ? format(new Date(d.date_in), "dd/MM/yyyy") : "—",
      c6: d.status.toUpperCase() 
    })));
  };

  const generatePDF = async (title: string, headers: string[], data: any[]) => {
    const doc = new jsPDF();
    const dateStr = format(new Date(), "dd/MM/yyyy HH:mm");
    
    let logoData = "";
    try {
      logoData = await loadImageAsDataURL(koeLogo);
    } catch (e) {
      console.error("Logo error", e);
    }

    // Header
    if (logoData) {
      doc.addImage(logoData, "PNG", 14, 10, 15, 15);
    }
    
    doc.setFontSize(18);
    doc.text(title, logoData ? 35 : 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${dateStr}`, logoData ? 35 : 14, 26);

    const body = data.map(r => headers.map((_, idx) => r[`c${idx + 1}`]));

    autoTable(doc, {
      startY: 32,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 7.5 },
      columnStyles: title.includes("Analítico") ? {
        0: { cellWidth: 25 }, // Código
        2: { cellWidth: 25 }, // TAG
        3: { cellWidth: 15 }, // Total
        4: { cellWidth: 15 }, // Emp.
        5: { cellWidth: 15 }, // Disp.
      } : {
        0: { cellWidth: 80 }, // Item
        1: { cellWidth: 22 }, // Total
        2: { cellWidth: 22 }, // Emp.
        3: { cellWidth: 22 }, // Disp.
        4: { cellWidth: 35 }, // Valor Total
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const cellText = String(data.cell.raw || "");
          const isGroup = cellText.startsWith("TIPO:");
          const isSubtotal = cellText.startsWith("Sub-total");
          const isTotal = cellText === "TOTAL GERAL";

          if (isGroup) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [37, 99, 235];
          } else if (isSubtotal) {
            data.cell.styles.fillColor = [248, 250, 252];
            data.cell.styles.fontStyle = 'bold';
          } else if (isTotal) {
            data.cell.styles.fillColor = [37, 99, 235];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`${title.toLowerCase().replace(/ /g, "_")}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  const exportExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      <BiLabel en="Reports" pt="Relatórios" />
      
      {/* SEÇÃO 1: INVENTÁRIO (AZUL) */}
      <Card className="p-6 border-t-4 border-t-blue-600 space-y-6 shadow-sm bg-slate-50/30">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <LayoutList className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-lg">Inventário de Ferramentas</h3>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase">Relatórios Gerais</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Opções Analítico */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b pb-2">
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><FileText className="h-4 w-4" /></div>
              <h4 className="font-bold text-slate-700">Relatório Analítico</h4>
            </div>
            <p className="text-xs text-slate-500">Lista detalhada de todas as ferramentas, incluindo código, TAG e valor individual.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleActionInventory("analytic", "view")}><Eye className="mr-2 h-4 w-4" /> Ver</Button>
              <Button size="sm" variant="outline" className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleActionInventory("analytic", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
              <Button size="sm" variant="outline" className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => handleActionInventory("analytic", "pdf")}><Download className="mr-2 h-4 w-4" /> PDF</Button>
            </div>
          </div>

          {/* Opções Sintético */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b pb-2">
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><LayoutList className="h-4 w-4" /></div>
              <h4 className="font-bold text-slate-700">Relatório Sintético</h4>
            </div>
            <p className="text-xs text-slate-500">Resumo consolidado por item, agrupando quantidades e valores totais.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleActionInventory("synthetic", "view")}><Eye className="mr-2 h-4 w-4" /> Ver</Button>
              <Button size="sm" variant="outline" className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleActionInventory("synthetic", "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
              <Button size="sm" variant="outline" className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => handleActionInventory("synthetic", "pdf")}><Download className="mr-2 h-4 w-4" /> PDF</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SEÇÃO 2: RASTREABILIDADE (VERDE) */}
        <Card className="p-6 border-t-4 border-t-green-600 space-y-4 shadow-sm bg-slate-50/30">
          <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-green-600" />
              <h3 className="font-bold">Rastreabilidade por Item</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 bg-white/50 rounded-lg border border-green-100 shadow-inner">
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-green-700">Tipo / Type</Label>
                    <Select value={traceType} onValueChange={setTraceType}><SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos</SelectItem>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-green-700">Filtrar TAG</Label><Input className="h-8 text-xs bg-white" value={traceTag} onChange={e => setTraceTag(e.target.value)} placeholder="TAG..." /></div>
            </div>
            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-green-700">Busca Rápida de Ferramenta</Label>
                <div className="relative"><Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" /><Input className="h-8 pl-7 text-xs bg-white" value={traceSearch} onChange={e => setTraceSearch(e.target.value)} placeholder="Nome ou código..." /></div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold">Ferramenta:</Label>
            <Select value={selectedToolId} onValueChange={setSelectedToolId}><SelectTrigger className="bg-white"><SelectValue placeholder="Escolha..." /></SelectTrigger>
            <SelectContent>{filteredTraceTools.map(t => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name} ({t.tag || 'S/T'})</SelectItem>)}</SelectContent></Select>
          </div>
          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handlePreviewTraceability("item")}><Eye className="mr-2 h-4 w-4" />Visualizar Histórico</Button>
        </Card>

        {/* SEÇÃO 3: TÉCNICO (ROXO) */}
        <Card className="p-6 border-t-4 border-t-purple-600 space-y-4 shadow-sm bg-slate-50/30">
          <div className="flex items-center gap-2"><UserSearch className="h-5 w-5 text-purple-600" /><h3 className="font-bold">Histórico por Técnico</h3></div>
          <div className="space-y-1 py-12">
            <Label className="text-xs font-bold text-purple-700">Selecione o Técnico</Label>
            <Select value={selectedTechId} onValueChange={setSelectedTechId}><SelectTrigger className="bg-white"><SelectValue placeholder="Escolha..." /></SelectTrigger>
            <SelectContent>{technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handlePreviewTraceability("tech")}><Eye className="mr-2 h-4 w-4" />Visualizar Atividades</Button>
        </Card>
      </div>

      {/* PREVIEW DA TABELA COM OPÇÃO DE PDF */}
      {previewData && (
        <Card className="mt-8 border-2 border-slate-900 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
          <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
            <h4 className="font-bold text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-blue-400" /> {previewTitle}</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => generatePDF(previewTitle, previewHeaders, previewData)}>
                <Download className="mr-2 h-4 w-4" /> Baixar PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)} className="text-white hover:bg-white/20"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 border-b">
                  {previewHeaders.map((h, idx) => (
                    <th key={idx} className="p-3 font-bold border-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="p-3 border-r font-mono">{r.c1}</td>
                    <td className="p-3 border-r">{r.c2}</td>
                    <td className="p-3 border-r">{r.c3}</td>
                    <td className="p-3 border-r">{r.c4}</td>
                    <td className="p-3 border-r">{r.c5}</td>
                    {r.c6 && <td className="p-3 font-bold">{r.c6}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Reports;
