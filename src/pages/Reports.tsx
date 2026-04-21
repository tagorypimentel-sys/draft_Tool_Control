import React, { useMemo, useState } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, FileText, LayoutList, ListChecks, History, UserSearch, Eye, X, FilterX, Search } from "lucide-react";
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
  
  // States para Inventário
  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("all");
  const [invTag, setInvTag] = useState("");

  // States para Rastreabilidade por Item
  const [selectedToolId, setSelectedToolId] = useState("");
  const [traceSearch, setTraceSearch] = useState("");
  const [traceCategory, setTraceCategory] = useState("all");
  const [traceTag, setTraceTag] = useState("");

  // State para Técnico
  const [selectedTechId, setSelectedTechId] = useState("");

  // Preview State
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const allTools = useMemo(() => { void version; return all<any>("SELECT * FROM tools ORDER BY name ASC"); }, [version]);
  const technicians = useMemo(() => { void version; return all<any>("SELECT * FROM technicians ORDER BY name ASC"); }, [version]);

  const categories = useMemo(() => {
    return Array.from(new Set(allTools.map(t => t.category).filter(Boolean))).sort() as string[];
  }, [allTools]);

  // Ferramentas filtradas para o Inventário
  const filteredInvTools = useMemo(() => {
    return allTools.filter(t => {
      const mS = !invSearch || t.name.toLowerCase().includes(invSearch.toLowerCase()) || t.code.toLowerCase().includes(invSearch.toLowerCase());
      const mC = invCategory === "all" || t.category === invCategory;
      const mT = !invTag || (t.tag || "").toLowerCase().includes(invTag.toLowerCase());
      return mS && mC && mT;
    });
  }, [allTools, invSearch, invCategory, invTag]);

  // Ferramentas filtradas para a SELEÇÃO na Rastreabilidade
  const filteredTraceTools = useMemo(() => {
    return allTools.filter(t => {
      const mS = !traceSearch || t.name.toLowerCase().includes(traceSearch.toLowerCase()) || t.code.toLowerCase().includes(traceSearch.toLowerCase());
      const mC = traceCategory === "all" || t.category === traceCategory;
      const mT = !traceTag || (t.tag || "").toLowerCase().includes(traceTag.toLowerCase());
      return mS && mC && mT;
    });
  }, [allTools, traceSearch, traceCategory, traceTag]);

  const fmtEUR = (v: number) => `€ ${v.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;

  const handlePreviewInventory = (type: "analytic" | "synthetic") => {
    if (!filteredInvTools.length) return toast.error("No data");
    setPreviewTitle(type === "analytic" ? "Inventário Analítico" : "Inventário Sintético");
    if (type === "analytic") {
      setPreviewData(filteredInvTools.map(t => ({ c1: t.code, c2: t.name, c3: t.tag || "—", c4: t.quantity, c5: fmtEUR((t.value_eur || 0) * t.quantity) })));
    } else {
      const summary = filteredInvTools.reduce((acc, t) => {
        if (!acc[t.name]) acc[t.name] = { name: t.name, qty: 0, total: 0 };
        acc[t.name].qty += t.quantity; acc[t.name].total += (t.value_eur || 0) * t.quantity;
        return acc;
      }, {} as any);
      setPreviewData(Object.values(summary).map((s: any) => ({ c1: s.name, c2: s.qty, c3: fmtEUR(s.total) })));
    }
  };

  const handlePreviewTraceability = (target: "item" | "tech") => {
    const id = target === "item" ? selectedToolId : selectedTechId;
    if (!id) return toast.error("Selecione um item ou técnico");
    const sql = target === "item" 
      ? `SELECT c.number, c.project, t.name as tech, c.date_out, ci.qty_out, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN technicians t ON t.id = c.technician_id WHERE ci.tool_id = ? ORDER BY c.date_out DESC`
      : `SELECT c.number, c.project, tl.name as tool, c.date_out, ci.qty_out, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN tools tl ON tl.id = ci.tool_id WHERE c.technician_id = ? ORDER BY c.date_out DESC`;
    const data = all<any>(sql, [id]);
    if (!data.length) return toast.error("Sem movimentações");
    setPreviewTitle(target === "item" ? "Rastreabilidade de Item" : "Histórico de Técnico");
    setPreviewData(data.map(d => ({ c1: d.number, c2: d.project, c3: d.tech || d.tool, c4: d.date_out ? format(new Date(d.date_out), "dd/MM/yyyy") : "—", c5: d.status })));
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
      <Card className="p-6 border-t-4 border-t-blue-600 space-y-4 shadow-sm bg-slate-50/30">
        <div className="flex items-center gap-2 mb-2">
            <LayoutList className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-lg">Inventário de Ferramentas</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Busca / Search</Label><Input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Código ou nome..." className="bg-white" /></div>
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Categoria</Label>
            <Select value={invCategory} onValueChange={setInvCategory}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as Categorias</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">TAG</Label><Input value={invTag} onChange={e => setInvTag(e.target.value)} placeholder="0000" className="bg-white" /></div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" variant="outline" onClick={() => handlePreviewInventory("analytic")}><Eye className="mr-2 h-4 w-4" />Ver Analítico</Button>
          <Button className="flex-1" variant="outline" onClick={() => handlePreviewInventory("synthetic")}><Eye className="mr-2 h-4 w-4" />Ver Sintético</Button>
          <Button variant="secondary" onClick={() => exportExcel(filteredInvTools, "inventario")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SEÇÃO 2: RASTREABILIDADE (VERDE) */}
        <Card className="p-6 border-t-4 border-t-green-600 space-y-4 shadow-sm bg-slate-50/30">
          <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-green-600" />
              <h3 className="font-bold">Rastreabilidade por Item</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-3 p-3 bg-white/50 rounded-lg border border-green-100">
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-green-700">Categoria</Label>
                    <Select value={traceCategory} onValueChange={setTraceCategory}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todas</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-green-700">Filtrar TAG</Label>
                    <Input className="h-8 text-xs" value={traceTag} onChange={e => setTraceTag(e.target.value)} placeholder="TAG..." />
                </div>
            </div>
            <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-green-700">Busca Rápida de Ferramenta</Label>
                <div className="relative">
                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                    <Input className="h-8 pl-7 text-xs" value={traceSearch} onChange={e => setTraceSearch(e.target.value)} placeholder="Nome ou código..." />
                </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">Selecione a Ferramenta:</Label>
            <Select value={selectedToolId} onValueChange={setSelectedToolId}>
                <SelectTrigger><SelectValue placeholder="Escolha um item da lista filtrada..." /></SelectTrigger>
                <SelectContent>
                    {filteredTraceTools.length === 0 ? (
                        <SelectItem value="_" disabled>Nenhum item encontrado</SelectItem>
                    ) : (
                        filteredTraceTools.map(t => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name} {t.tag ? `(${t.tag})` : ""}</SelectItem>)
                    )}
                </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handlePreviewTraceability("item")}><Eye className="mr-2 h-4 w-4" />Visualizar Histórico</Button>
        </Card>

        {/* SEÇÃO 3: TÉCNICO (ROXO) */}
        <Card className="p-6 border-t-4 border-t-purple-600 space-y-4 shadow-sm bg-slate-50/30">
          <div className="flex items-center gap-2">
              <UserSearch className="h-5 w-5 text-purple-600" />
              <h3 className="font-bold">Histórico por Técnico</h3>
          </div>
          <div className="space-y-1 py-12">
            <Label className="text-xs font-bold">Técnico / Technician</Label>
            <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                <SelectTrigger><SelectValue placeholder="Selecione o técnico..." /></SelectTrigger>
                <SelectContent>{technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handlePreviewTraceability("tech")}><Eye className="mr-2 h-4 w-4" />Visualizar Atividades</Button>
        </Card>
      </div>

      {/* PREVIEW DA TABELA */}
      {previewData && (
        <Card className="mt-8 border-2 border-slate-900 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
          <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
            <h4 className="font-bold text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-blue-400" /> {previewTitle}</h4>
            <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)} className="text-white hover:bg-white/20"><X className="h-4 w-4" /></Button>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="p-3 font-bold border-r">Info 1</th>
                  <th className="p-3 font-bold border-r">Info 2</th>
                  <th className="p-3 font-bold border-r">Info 3</th>
                  <th className="p-3 font-bold border-r">Info 4</th>
                  <th className="p-3 font-bold">Status/Total</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="p-3 border-r font-mono">{r.c1}</td>
                    <td className="p-3 border-r">{r.c2}</td>
                    <td className="p-3 border-r">{r.c3}</td>
                    <td className="p-3 border-r">{r.c4}</td>
                    <td className="p-3 font-bold">{r.c5}</td>
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
