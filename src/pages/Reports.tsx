import React, { useMemo, useState } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText, History, UserSearch, Eye, X, Filter } from "lucide-react";
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
  const [selectedToolId, setSelectedToolId] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("all");
  const [invTag, setInvTag] = useState("");
  
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const allTools = useMemo(() => { void version; return all<any>("SELECT * FROM tools ORDER BY name ASC"); }, [version]);
  const technicians = useMemo(() => { void version; return all<any>("SELECT * FROM technicians ORDER BY name ASC"); }, [version]);

  const categories = useMemo(() => {
    return Array.from(new Set(allTools.map(t => t.category).filter(Boolean))).sort() as string[];
  }, [allTools]);

  const filteredTools = useMemo(() => {
    return allTools.filter(t => {
      const matchSearch = !invSearch || t.name.toLowerCase().includes(invSearch.toLowerCase()) || t.code.toLowerCase().includes(invSearch.toLowerCase());
      const matchCategory = invCategory === "all" || t.category === invCategory;
      const matchTag = !invTag || (t.tag || "").toLowerCase().includes(invTag.toLowerCase());
      return matchSearch && matchCategory && matchTag;
    });
  }, [allTools, invSearch, invCategory, invTag]);

  const fmtEUR = (v: number) => `€ ${v.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;

  const handlePreviewInventory = (type: "analytic" | "synthetic") => {
    if (!filteredTools.length) return toast.error("No data");
    setPreviewTitle(type === "analytic" ? "Inventário Analítico" : "Inventário Sintético");
    if (type === "analytic") {
      setPreviewData(filteredTools.map(t => ({ c1: t.code, c2: t.name, c3: t.tag || "—", c4: t.quantity, c5: fmtEUR((t.value_eur || 0) * t.quantity) })));
    } else {
      const summary = filteredTools.reduce((acc, t) => {
        if (!acc[t.name]) acc[t.name] = { name: t.name, qty: 0, total: 0 };
        acc[t.name].qty += t.quantity; acc[t.name].total += (t.value_eur || 0) * t.quantity;
        return acc;
      }, {} as any);
      setPreviewData(Object.values(summary).map((s: any) => ({ c1: s.name, c2: s.qty, c3: fmtEUR(s.total) })));
    }
  };

  const handlePreviewTraceability = (target: "item" | "tech") => {
    const id = target === "item" ? selectedToolId : selectedTechId;
    if (!id) return toast.error("Select target");
    const sql = target === "item" 
      ? `SELECT c.number, c.project, t.name as tech, c.date_out, ci.qty_out, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN technicians t ON t.id = c.technician_id WHERE ci.tool_id = ?`
      : `SELECT c.number, c.project, tl.name as tool, c.date_out, ci.qty_out, c.status FROM cautela_items ci JOIN cautelas c ON c.id = ci.cautela_id JOIN tools tl ON tl.id = ci.tool_id WHERE c.technician_id = ?`;
    const data = all<any>(sql, [id]);
    if (!data.length) return toast.error("No movements");
    setPreviewTitle("Rastreabilidade");
    setPreviewData(data.map(d => ({ c1: d.number, c2: d.project, c3: d.tech || d.tool, c4: d.date_out ? format(new Date(d.date_out), "dd/MM/yyyy") : "—", c5: d.status })));
  };

  const exportInventory = (type: "analytic" | "synthetic", formatType: "excel" | "pdf") => {
    if (!filteredTools.length) return toast.error("No data");
    const rows = filteredTools.map(t => ({ Code: t.code, Name: t.name, TAG: t.tag || "", Qty: t.quantity, Total: (t.value_eur || 0) * t.quantity }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory.xlsx`);
  };

  return (
    <div className="space-y-6 pb-10">
      <BiLabel en="Reports" pt="Relatórios" />
      
      <Card className="p-6 border-t-4 border-t-blue-600 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1"><Label>Busca / Search</Label><Input value={invSearch} onChange={e => setInvSearch(e.target.value)} /></div>
          <div className="space-y-1"><Label>Categoria / Category</Label>
            <Select value={invCategory} onValueChange={setInvCategory}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>TAG</Label><Input value={invTag} onChange={e => setInvTag(e.target.value)} /></div>
        </div>
        <div className="flex gap-4">
          <Button className="flex-1" variant="outline" onClick={() => handlePreviewInventory("analytic")}>Ver Analítico</Button>
          <Button className="flex-1" variant="outline" onClick={() => handlePreviewInventory("synthetic")}>Ver Sintético</Button>
          <Button variant="secondary" onClick={() => exportInventory("analytic", "excel")}>Excel</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border-t-4 border-t-green-600 space-y-4">
          <h3 className="font-bold">Rastreabilidade Item</h3>
          <Select value={selectedToolId} onValueChange={setSelectedToolId}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>{allTools.map(t => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name}</SelectItem>)}</SelectContent></Select>
          <Button className="w-full" onClick={() => handlePreviewTraceability("item")}>Visualizar</Button>
        </Card>
        <Card className="p-6 border-t-4 border-t-purple-600 space-y-4">
          <h3 className="font-bold">Histórico Técnico</h3>
          <Select value={selectedTechId} onValueChange={setSelectedTechId}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>{technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
          <Button className="w-full" onClick={() => handlePreviewTraceability("tech")}>Visualizar</Button>
        </Card>
      </div>

      {previewData && (
        <Card className="p-4 border-2 border-slate-900">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h4 className="font-bold">{previewTitle}</h4>
            <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100"><th className="p-2 text-left">Info 1</th><th className="p-2 text-left">Info 2</th><th className="p-2 text-left">Info 3</th></tr></thead>
              <tbody>
                {previewData.map((r, i) => (
                  <tr key={i} className="border-b"><td className="p-2">{r.c1}</td><td className="p-2">{r.c2}</td><td className="p-2">{r.c3}</td></tr>
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
