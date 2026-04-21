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

  const fmt = (v: number) => {
    return `€ ${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const exportAnalyticExcel = () => {
    if (!tools.length) return toast.error("No data / Sem dados");
    const rows = tools.map((t) => ({
      Code: t.code,
      Name: t.name,
      Brand: t.brand || "",
      Model: t.model || "",
      TAG: t.tag || "",
      Quantity: t.quantity,
      "Unit Value (EUR)": t.value_eur || 0,
      "Total Value (EUR)": (t.value_eur || 0) * t.quantity,
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytic Inventory");
    XLSX.writeFile(wb, `inventory_analytic.xlsx`);
  };

  const exportSyntheticExcel = () => {
    if (!tools.length) return toast.error("No data / Sem dados");
    const summaryMap = tools.reduce((acc, t) => {
      const key = t.name;
      if (!acc[key]) acc[key] = { Name: key, Qty: 0, Total: 0 };
      acc[key].Qty += t.quantity;
      acc[key].Total += (t.value_eur || 0) * t.quantity;
      return acc;
    }, {} as Record<string, { Name: string; Qty: number; Total: number }>);

    const rows = Object.values(summaryMap).map(s => ({
      "Nome / Name": s.Name,
      "Qtd / Qty": s.Qty,
      "Total (EUR)": s.Total
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Synthetic Inventory");
    XLSX.writeFile(wb, `inventory_synthetic.xlsx`);
  };

  const exportPdf = async (type: "analytic" | "synthetic") => {
    if (!tools.length) return toast.error("No data / Sem dados");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let logoData: string | null = null;
    try { logoData = await loadImageAsDataURL(koeLogo); } catch { logoData = null; }

    const drawHeaderFooter = () => {
      if (logoData) doc.addImage(logoData, "PNG", 10, 5, 25, 14);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(type === "analytic" ? "Inventário Analítico" : "Inventário Sintético", 40, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(type === "analytic" ? "Analytic Inventory" : "Synthetic Inventory", 40, 18);
    };

    let headers: string[] = [];
    let body: any[] = [];
    let totalValue = 0;

    if (type === "analytic") {
      headers = ["Código\nCode", "Nome\nName", "Marca\nBrand", "TAG", "Qtd\nQty", "Unit.", "Total"];
      body = tools.map(t => {
        const total = (t.value_eur || 0) * t.quantity;
        totalValue += total;
        return [t.code, t.name, t.brand, t.tag, t.quantity, fmt(t.value_eur || 0), fmt(total)];
      });
    } else {
      const summaryMap = tools.reduce((acc, t) => {
        const key = t.name;
        if (!acc[key]) acc[key] = { Name: key, Qty: 0, Total: 0 };
        acc[key].Qty += t.quantity;
        acc[key].Total += (t.value_eur || 0) * t.quantity;
        return acc;
      }, {} as Record<string, { Name: string; Qty: number; Total: number }>);
      headers = ["Nome / Name", "Qtd / Qty", "Total (EUR)"];
      body = Object.values(summaryMap).map(s => {
        totalValue += s.Total;
        return [s.Name, s.Qty, fmt(s.Total)];
      });
    }

    autoTable(doc, {
      head: [headers],
      body,
      startY: 28,
      didDrawPage: drawHeaderFooter,
      headStyles: { fillColor: [37, 99, 235], halign: 'left' },
      styles: { fontSize: 8, halign: 'left' },
      theme: 'striped'
    });

    doc.save(`inventory_${type}.pdf`);
  };

  return (
    <div className="space-y-6">
      <BiLabel en="Reports" pt="Relatórios" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4 border-t-4 border-t-blue-600">
          <div className="flex items-center gap-3">
            <LayoutList className="h-6 w-6 text-blue-600" />
            <h3 className="font-bold text-lg">Inventário Analítico</h3>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={exportAnalyticExcel}>Excel</Button>
            <Button className="flex-1" variant="outline" onClick={() => exportPdf("analytic")}>PDF</Button>
          </div>
        </Card>
        <Card className="p-6 space-y-4 border-t-4 border-t-purple-600">
          <div className="flex items-center gap-3">
            <ListChecks className="h-6 w-6 text-purple-600" />
            <h3 className="font-bold text-lg">Inventário Sintético</h3>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={exportSyntheticExcel}>Excel</Button>
            <Button className="flex-1" variant="outline" onClick={() => exportPdf("synthetic")}>PDF</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
