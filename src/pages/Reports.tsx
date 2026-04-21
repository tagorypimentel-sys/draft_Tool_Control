import { useMemo } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, LayoutList, ListChecks } from "lucide-react";
import { all } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import koeLogo from "@/assets/koe-logo.gif";
import { toast } from "sonner";
import { formatEUR } from "@/lib/format";

type Tool = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  serial_tag: string | null;
  tag: string | null;
  category: string | null;
  location: string | null;
  status: string;
  quantity: number;
  value_eur: number | null;
};

const Reports = () => {
  const { version } = useDb();

  const tools = useMemo(() => {
    void version;
    return all<Tool>("SELECT * FROM tools ORDER BY name ASC");
  }, [version]);

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

  const exportAnalyticExcel = () => {
    if (!tools.length) return toast.error("No data / Sem dados");
    const rows = tools.map((t) => ({
      Code: t.code,
      Name: t.name,
      Brand: t.brand || "",
      Model: t.model || "",
      Category: t.category || "",
      Type: t.type || "",
      Serial: t.serial_tag || "",
      TAG: t.tag || "",
      Status: t.status,
      Quantity: t.quantity,
      "Unit Value (EUR)": t.value_eur || 0,
      "Total Value (EUR)": (t.value_eur || 0) * t.quantity,
      Location: t.location || "",
    }));
    
    const totalValue = rows.reduce((acc, r) => acc + r["Total Value (EUR)"], 0);
    rows.push({
      Code: "TOTAL",
      Name: "SUM / SOMA",
      Brand: "", Model: "", Category: "", Type: "", Serial: "", TAG: "", Status: "",
      Quantity: rows.reduce((acc, r) => acc + (typeof r.Quantity === 'number' ? r.Quantity : 0), 0),
      "Unit Value (EUR)": 0,
      "Total Value (EUR)": totalValue,
      Location: ""
    } as any);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytic Inventory");
    XLSX.writeFile(wb, `inventory_analytic_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported / Excel exportado");
  };

  const exportSyntheticExcel = () => {
    if (!tools.length) return toast.error("No data / Sem dados");
    
    const summaryMap = tools.reduce((acc, t) => {
      const key = t.name;
      if (!acc[key]) {
        acc[key] = { Name: key, Quantity: 0, UnitValue: t.value_eur || 0, TotalValue: 0 };
      }
      acc[key].Quantity += t.quantity;
      acc[key].TotalValue += (t.value_eur || 0) * t.quantity;
      return acc;
    }, {} as Record<string, { Name: string; Quantity: number; UnitValue: number; TotalValue: number }>);

    const rows = Object.values(summaryMap).map(s => ({
      "Tool Name / Nome": s.Name,
      "Total Qty / Qtd Total": s.Quantity,
      "Unit Value (EUR) / Val. Unit": s.UnitValue,
      "Total Value (EUR) / Val. Total": s.TotalValue
    }));

    const grandTotal = rows.reduce((acc, r) => acc + r["Total Value (EUR) / Val. Total"], 0);
    rows.push({
      "Tool Name / Nome": "TOTAL GERAL",
      "Total Qty / Qtd Total": rows.reduce((acc, r) => acc + r["Total Qty / Qtd Total"], 0),
      "Unit Value (EUR) / Val. Unit": 0,
      "Total Value (EUR) / Val. Total": grandTotal
    } as any);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Synthetic Inventory");
    XLSX.writeFile(wb, `inventory_synthetic_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported / Excel exportado");
  };

  const exportPdf = async (type: "analytic" | "synthetic") => {
    if (!tools.length) return toast.error("No data / Sem dados");
    
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let logoData: string | null = null;
    try {
      logoData = await loadImageAsDataURL(koeLogo);
    } catch {
      logoData = null;
    }

    const drawHeaderFooter = () => {
      if (logoData) {
        doc.addImage(logoData, "PNG", 10, 5, 25, 14);
      }
      
      const titlePt = type === "analytic" ? "Inventário Analítico" : "Inventário Sintético";
      const titleEn = type === "analytic" ? "Analytic Inventory" : "Synthetic Inventory";

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40);
      doc.text(titlePt, 40, 12);

      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
      doc.text(titleEn, 40, 18);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(new Date().toLocaleString(), pageWidth - 10, 10, { align: "right" });
      doc.line(10, 23, pageWidth - 10, 23);
      
      // Footer
      doc.setFontSize(8);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    };

    let headers: string[] = [];
    let body: any[] = [];
    let totalValue = 0;

    const fmt = (v: number) => {
      return `€ ${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (type === "analytic") {
      headers = [
        "Código\nCode", 
        "Nome da Ferramenta\nTool Name", 
        "Marca\nBrand", 
        "Modelo\nModel", 
        "TAG\nTAG", 
        "Qtd\nQty", 
        "Val. Unit.\nUnit Val.", 
        "Val. Total\nTotal Val."
      ];
      body = tools.map(t => {
        const total = (t.value_eur || 0) * t.quantity;
        totalValue += total;
        return [t.code, t.name, t.brand, t.model, t.tag, t.quantity, fmt(t.value_eur || 0), fmt(total)];
      });
      body.push([{ content: 'TOTAL GERAL / GRAND TOTAL', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(totalValue), styles: { fontStyle: 'bold' } }]);
    } else {
      const summaryMap = tools.reduce((acc, t) => {
        const key = t.name;
        if (!acc[key]) acc[key] = { Name: key, Qty: 0, Unit: t.value_eur || 0, Total: 0 };
        acc[key].Qty += t.quantity;
        acc[key].Total += (t.value_eur || 0) * t.quantity;
        return acc;
      }, {} as Record<string, { Name: string; Qty: number; Unit: number; Total: number }>);
      
      headers = [
        "Nome da Ferramenta\nTool Name", 
        "Quantidade Total\nTotal Quantity", 
        "Val. Unit.\nUnit Value", 
        "Val. Total (EUR)\nTotal Value"
      ];
      body = Object.values(summaryMap).map(s => {
        totalValue += s.Total;
        return [s.Name, s.Qty, fmt(s.Unit), fmt(s.Total)];
      });
      body.push([{ content: 'TOTAL GERAL / GRAND TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(totalValue), styles: { fontStyle: 'bold' } }]);
    }

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 28,
      didDrawPage: drawHeaderFooter,
      headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'left', valign: 'middle' },
      styles: { fontSize: 8, cellPadding: 2, halign: 'left' },
      theme: 'striped',
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' }
      }
    });

    doc.save(`inventory_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported / PDF exportado");
  };

  return (
    <div className="space-y-6">
      <BiLabel en="Reports" pt="Relatórios" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inventário Analítico */}
        <Card className="p-6 space-y-4 border-t-4 border-t-blue-600">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <LayoutList className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Inventário Analítico</h3>
              <p className="text-sm text-muted-foreground">Listagem detalhada item a item com códigos e TAGs individuais.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button className="flex-1" variant="outline" onClick={exportAnalyticExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => exportPdf("analytic")}>
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </Card>

        {/* Inventário Sintético */}
        <Card className="p-6 space-y-4 border-t-4 border-t-purple-600">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
              <ListChecks className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Inventário Sintético</h3>
              <p className="text-sm text-muted-foreground">Resumo consolidado agrupando itens iguais com somatório de valores.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button className="flex-1" variant="outline" onClick={exportSyntheticExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => exportPdf("synthetic")}>
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
