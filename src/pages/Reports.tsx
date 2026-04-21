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

  const exportGeneralExcel = () => {
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
      Value: t.value_eur || 0,
      Location: t.location || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "General Inventory");
    XLSX.writeFile(wb, `inventory_general_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported / Excel exportado");
  };

  const exportSummaryExcel = () => {
    if (!tools.length) return toast.error("No data / Sem dados");
    
    // Group by name
    const summaryMap = tools.reduce((acc, t) => {
      const key = t.name;
      if (!acc[key]) {
        acc[key] = { Name: key, Quantity: 0, Items: [] as string[] };
      }
      acc[key].Quantity += t.quantity;
      if (t.tag) acc[key].Items.push(t.tag);
      return acc;
    }, {} as Record<string, { Name: string; Quantity: number; Items: string[] }>);

    const rows = Object.values(summaryMap).map(s => ({
      "Tool Name / Nome": s.Name,
      "Total Quantity / Qtd Total": s.Quantity,
      "Tags": s.Items.join(", ")
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary Report");
    XLSX.writeFile(wb, `inventory_summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported / Excel exportado");
  };

  const exportPdf = async (type: "general" | "summary") => {
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
        doc.addImage(logoData, "PNG", 10, 6, 25, 14);
      }
      doc.setFontSize(14);
      doc.text(type === "general" ? "Inventário Geral / General Inventory" : "Resumo de Inventário / Inventory Summary", 40, 15);
      doc.setFontSize(8);
      doc.text(new Date().toLocaleString(), pageWidth - 10, 10, { align: "right" });
      doc.line(10, 23, pageWidth - 10, 23);
      
      // Footer
      doc.setFontSize(8);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    };

    let headers: string[] = [];
    let body: any[] = [];

    if (type === "general") {
      headers = ["Code", "Name", "Brand", "Model", "Type", "TAG", "Status", "Qty"];
      body = tools.map(t => [t.code, t.name, t.brand, t.model, t.type, t.tag, t.status, t.quantity]);
    } else {
      const summaryMap = tools.reduce((acc, t) => {
        const key = t.name;
        if (!acc[key]) acc[key] = { Name: key, Qty: 0 };
        acc[key].Qty += t.quantity;
        return acc;
      }, {} as Record<string, { Name: string; Qty: number }>);
      
      headers = ["Tool Name / Nome da Ferramenta", "Total Quantity / Quantidade Total"];
      body = Object.values(summaryMap).map(s => [s.Name, s.Qty]);
    }

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 28,
      didDrawPage: drawHeaderFooter,
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });

    doc.save(`report_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported / PDF exportado");
  };

  return (
    <div className="space-y-6">
      <BiLabel en="Reports" pt="Relatórios" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inventário Geral */}
        <Card className="p-6 space-y-4 border-t-4 border-t-blue-600">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <LayoutList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Inventário Geral</h3>
              <p className="text-sm text-muted-foreground">Listagem completa com todos os itens e detalhes individuais.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button className="flex-1" variant="outline" onClick={exportGeneralExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => exportPdf("general")}>
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </Card>

        {/* Resumo de Inventário */}
        <Card className="p-6 space-y-4 border-t-4 border-t-purple-600">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
              <ListChecks className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Resumo de Inventário</h3>
              <p className="text-sm text-muted-foreground">Relatório consolidado agrupando itens iguais e somando as quantidades.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button className="flex-1" variant="outline" onClick={exportSummaryExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => exportPdf("summary")}>
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
