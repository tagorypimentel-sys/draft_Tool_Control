import { useState, useMemo, useRef } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Search, Upload, X, Eye, Copy, FileSpreadsheet, FileText, Timer, ClipboardCheck } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { all, run, uid } from "@/lib/db";
import koeLogo from "@/assets/koe-logo.gif";
import { useDb } from "@/hooks/useDb";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";
import { getCalibrationStatus, CALIBRATION_STATUS_CLASSES, getCalibrationBadgeLabel } from "@/lib/calibration";
import { useLanguage } from "@/hooks/useLanguage";

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
  acquisition_date: string | null;
  value_eur: number | null;
  quantity: number;
  quantity_out_of_service: number;
  notes: string | null;
  photo_url: string | null;
  requires_calibration: number;
  requires_inspection: number;
  next_calibration_date: string | null;
};

const STATUSES: { v: string; en: string; pt: string; cls: string }[] = [
  { v: "available", en: "Available", pt: "Disponível", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { v: "in_use", en: "In use", pt: "Em uso", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { v: "out", en: "Out", pt: "Saída", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { v: "maintenance", en: "Maintenance", pt: "Manutenção", cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  { v: "calibration", en: "Calibration", pt: "Calibração", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { v: "out_of_service", en: "Out of service", pt: "Fora de uso", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
];

const TYPE_OPTIONS = [
  "Rope Access", "PPE", "Load/Lift", "Electrical", "Abrasive", "Welding",
  "General", "Painting", "Polish", "Cleaning", "Corded", "Cordless",
  "Pneumatics", "Measurement", "Hand",
];

const empty: Partial<Tool> = {
  code: "",
  name: "",
  brand: "",
  model: "",
  type: "",
  serial_tag: "",
  tag: "",
  category: "Tool",
  status: "available",
  quantity: 1,
  notes: "",
  photo_url: "",
  requires_calibration: 0,
  requires_inspection: 0,
};

function nextCode(): string {
  const rows = all<{ code: string }>("SELECT code FROM tools WHERE code GLOB '[0-9]*'");
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.code, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1).padStart(5, "0");
}

const Inventory = () => {
  const { version, bump } = useDb();
  const { lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Tool>>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [quickView, setQuickView] = useState<Tool | null>(null);
  const [batchSource, setBatchSource] = useState<Tool | null>(null);
  const [batchQty, setBatchQty] = useState<number>(1);
  const [batchTags, setBatchTags] = useState<string>("");

  const tools = useMemo(() => {
    void version;
    return all<Tool>("SELECT * FROM tools ORDER BY created_at DESC");
  }, [version]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(tools.map((t) => t.category).filter((c): c is string => !!c))).sort(),
    [tools]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(tools.map((t) => t.type).filter((c): c is string => !!c))).sort(),
    [tools]
  );

  const filtered = tools.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
    const matchType = typeFilter === "all" || t.type === typeFilter;
    return matchSearch && matchStatus && matchCategory && matchType;
  });

  const exportRows = () =>
    filtered.map((t) => ({
      Code: t.code,
      Name: t.name,
      Brand: t.brand || "",
      Model: t.model || "",
      Category: t.category || "",
      Type: t.type || "",
      "Serial / Série": t.serial_tag || "",
      TAG: t.tag || "",
      Status: t.status,
      Quantity: t.quantity,
      "Out of service": t.quantity_out_of_service,
      "Value (EUR)": t.value_eur ?? 0,
      Location: t.location || "",
      Notes: t.notes || "",
    }));

  const exportExcel = () => {
    const rows = exportRows();
    if (!rows.length) {
      toast.error("No data to export / Sem dados para exportar");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported / Excel exportado");
  };

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

  const exportPdf = async () => {
    const rows = exportRows();
    if (!rows.length) {
      toast.error("No data to export / Sem dados para exportar");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let logoData: string | null = null;
    let logoRatio = 1;
    try {
      logoData = await loadImageAsDataURL(koeLogo);
      const probe = new Image();
      probe.src = logoData;
      await new Promise((r) => { probe.onload = r; probe.onerror = r; });
      if (probe.naturalHeight) logoRatio = probe.naturalWidth / probe.naturalHeight;
    } catch {
      logoData = null;
    }

    const dateStr = new Date().toLocaleString();
    const drawHeaderFooter = () => {
      const logoH = 14;
      const logoW = logoH * logoRatio;
      if (logoData) {
        try { doc.addImage(logoData, "PNG", 10, 6, logoW, logoH); } catch { /* noop */ }
      }
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("KOE Draft Tool Control — Inventory / Inventário", 10 + logoW + 4, 14);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(dateStr, pageWidth - 10, 10, { align: "right" });
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      doc.line(10, 23, pageWidth - 10, 23);

      // Footer separator
      doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("KOE Draft Tool Control", pageWidth - 10, pageHeight - 6, { align: "right" });
      // Page number placeholder; final pass updates totals
      const pageNum = doc.getNumberOfPages();
      doc.text(`Page ${pageNum} / Página ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: "center" });
    };

    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) => headers.map((h) => String((r as Record<string, unknown>)[h] ?? ""))),
      startY: 28,
      margin: { top: 28, bottom: 16, left: 10, right: 10 },
      styles: { fontSize: 7 },
      headStyles: { fillColor: [37, 99, 235] },
      didDrawPage: drawHeaderFooter,
    });

    // Final pass: rewrite footer page numbers with correct total
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      // White-out previous centered page number
      doc.setFillColor(255, 255, 255);
      doc.rect(pageWidth / 2 - 40, pageHeight - 10, 80, 6, "F");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Page ${i} of ${total} / Página ${i} de ${total}`, pageWidth / 2, pageHeight - 6, { align: "center" });
    }

    doc.save(`inventory_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported / PDF exportado");
  };

  const openNew = () => {
    setEditId(null);
    setForm({ ...empty, code: nextCode() });
    setOpen(true);
  };
  const openEdit = (t: Tool) => {
    setEditId(t.id);
    setForm(t);
    setOpen(true);
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max 2MB / Máximo 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo_url: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.code || !form.name) {
      toast.error("Code and Name are required / Código e Nome obrigatórios");
      return;
    }
    if (form.tag && !/^\d{4}$/.test(String(form.tag).trim())) {
      toast.error("TAG must be 4 digits / TAG deve ter 4 dígitos");
      return;
    }
    const tagValue = form.tag ? String(form.tag).trim() : null;
    if (editId) {
      run(
        `UPDATE tools SET code=?, name=?, brand=?, model=?, type=?, serial_tag=?, tag=?, category=?, status=?, acquisition_date=?, value_eur=?, quantity=?, notes=?, photo_url=?, requires_calibration=?, requires_inspection=? WHERE id=?`,
        [form.code, form.name, form.brand || null, form.model || null, form.type || null, form.serial_tag || null, tagValue,
        form.category || null, form.status || "available",
        form.acquisition_date || null, Number(form.value_eur) || 0, Number(form.quantity) || 1,
        form.notes || null, form.photo_url || null,
        form.requires_calibration ? 1 : 0, form.requires_inspection ? 1 : 0, editId]
      );
      toast.success("Tool updated / Ferramenta atualizada");
    } else {
      run(
        `INSERT INTO tools (id, code, name, brand, model, type, serial_tag, tag, category, status, acquisition_date, value_eur, quantity, notes, photo_url, requires_calibration, requires_inspection)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uid(), form.code, form.name, form.brand || null, form.model || null, form.type || null, form.serial_tag || null, tagValue,
        form.category || null, form.status || "available",
        form.acquisition_date || null, Number(form.value_eur) || 0, Number(form.quantity) || 1,
        form.notes || null, form.photo_url || null,
        form.requires_calibration ? 1 : 0, form.requires_inspection ? 1 : 0]
      );
      toast.success("Tool added / Ferramenta adicionada");
    }
    setOpen(false);
    bump();
  };

  const changeStatus = (t: Tool, status: string) => {
    run("UPDATE tools SET status=? WHERE id=?", [status, t.id]);
    bump();
    toast.success("Status changed / Status alterado");
  };

  const statusBadge = (s: string) => {
    const found = STATUSES.find((x) => x.v === s) || STATUSES[0];
    return (
      <span className={`inline-flex flex-col items-start px-2 py-0.5 rounded text-[11px] ${found.cls}`}>
        <span className="font-bold leading-tight">{found.en}</span>
        <span className="italic text-[9px] leading-tight opacity-80">{found.pt}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <BiLabel en="Inventory" pt="Inventário" />
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={exportExcel} title="Export to Excel / Exportar para Excel">
            <FileSpreadsheet />
            <BiLabel en="Excel" pt="Excel" size="small" />
          </Button>
          <Button variant="outline" onClick={exportPdf} title="Export to PDF / Exportar para PDF">
            <FileText />
            <BiLabel en="PDF" pt="PDF" size="small" />
          </Button>
          <Button onClick={openNew}>
            <Plus />
            <BiLabel en="Add tool" pt="Adicionar ferramenta" size="small" />
          </Button>
        </div>
      </div>

      <Card className="p-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code or name / Buscar por código ou nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status / Todos</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.v} value={s.v}>{s.en} / {s.pt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category / Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories / Todas</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type / Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types / Todos</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><BiLabel en="Photo" pt="Foto" size="table" /></TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead><BiLabel en="Code" pt="Código" size="table" /></TableHead>
              <TableHead><BiLabel en="Name" pt="Nome" size="table" /></TableHead>
              <TableHead><BiLabel en="Brand" pt="Marca" size="table" /></TableHead>
              <TableHead><BiLabel en="Category" pt="Categoria" size="table" /></TableHead>
              <TableHead><BiLabel en="Type" pt="Tipo" size="table" /></TableHead>
              <TableHead><BiLabel en="Serial" pt="Série" size="table" /></TableHead>
              <TableHead><BiLabel en="TAG" pt="TAG" size="table" /></TableHead>
              <TableHead className="text-center"><BiLabel en="Maint." pt="Manut." size="table" /></TableHead>
              <TableHead><BiLabel en="Status" pt="Status" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Qty" pt="Qtd" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Value" pt="Valor" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Actions" pt="Ações" size="table" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-10">
                  <BiLabel en="No tools found" pt="Nenhuma ferramenta encontrada" className="items-center" />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setQuickView(t)} title="Quick view">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{t.code}</TableCell>
                  <TableCell className="font-medium">
                    {t.name}
                  </TableCell>
                  <TableCell>{t.brand || "—"}</TableCell>
                  <TableCell>{t.category || "—"}</TableCell>
                  <TableCell>{t.type || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{t.serial_tag || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{t.tag || "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      {t.requires_calibration ? (
                        <Timer className="h-4 w-4 text-sky-600 dark:text-sky-400" title="Requires Calibration / Exige Calibração" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      {t.requires_inspection ? (
                        <ClipboardCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" title="Requires Inspection / Exige Inspeção" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.requires_calibration && ["red", "never"].includes(getCalibrationStatus(t.next_calibration_date))
                      ? statusBadge("calibration")
                      : statusBadge(t.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.quantity}
                    {t.quantity_out_of_service > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">({t.quantity_out_of_service})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatEUR(t.value_eur)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setBatchSource(t);
                          setBatchQty(1);
                          setBatchTags("");
                        }}
                        title="Duplicate in batch / Duplicar em lote"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <BiLabel en={editId ? "Edit tool" : "Add tool"} pt={editId ? "Editar ferramenta" : "Adicionar ferramenta"} />
            </DialogTitle>
          </DialogHeader>

          {/* Photo upload */}
          <div className="flex items-center gap-3">
            {form.photo_url ? (
              <div className="relative">
                <img src={form.photo_url} alt="" className="h-20 w-20 rounded object-cover border" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, photo_url: "" })}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 rounded bg-muted flex items-center justify-center border">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <Label><BiLabel en="Photo" pt="Foto" size="small" /></Label>
              <Input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPhotoChange}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label><BiLabel en="Code (auto)" pt="Código (auto)" size="small" /></Label>
              <Input value={form.code || ""} readOnly className="bg-muted font-mono" />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Name" pt="Nome" size="small" /></Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Brand" pt="Marca" size="small" /></Label>
              <Input value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Model" pt="Modelo" size="small" /></Label>
              <Input value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Type" pt="Tipo" size="small" /></Label>
              <Select value={form.type || ""} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Serial" pt="Série" size="small" /></Label>
              <Input value={form.serial_tag || ""} onChange={(e) => setForm({ ...form, serial_tag: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="TAG (4 digits)" pt="TAG (4 dígitos)" size="small" /></Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                placeholder="0000"
                value={form.tag || ""}
                onChange={(e) => setForm({ ...form, tag: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Quantity" pt="Quantidade" size="small" /></Label>
              <Input type="number" min={0} value={form.quantity ?? 1} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value, 10) || 0 })} />
            </div>

            {/* Category toggle */}
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-md">
              <div>
                <Label className="cursor-pointer">
                  <BiLabel en="Category" pt="Categoria" size="small" />
                </Label>
                <div className="text-xs text-muted-foreground mt-1">
                  {form.category === "Consumable"
                    ? "Consumable / Consumível"
                    : "Tool / Ferramenta"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">Tool</span>
                <Switch
                  checked={form.category === "Consumable"}
                  onCheckedChange={(v) => setForm({ ...form, category: v ? "Consumable" : "Tool" })}
                />
                <span className="text-xs">Consumable</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label><BiLabel en="Status" pt="Status" size="small" /></Label>
              <Select value={form.status || "available"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.v} value={s.v}>{s.en} / {s.pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Acquisition date" pt="Data de aquisição" size="small" /></Label>
              <Input type="date" value={form.acquisition_date || ""} onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label><BiLabel en="Value (€)" pt="Valor (€)" size="small" /></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-7"
                  value={form.value_eur ?? ""}
                  onChange={(e) => setForm({ ...form, value_eur: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Calibration & Inspection toggles */}
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-md">
              <Label className="cursor-pointer">
                <BiLabel en="Requires calibration" pt="Exige calibração" size="small" />
              </Label>
              <Switch
                checked={!!form.requires_calibration}
                onCheckedChange={(v) => setForm({ ...form, requires_calibration: v ? 1 : 0 })}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-md">
              <Label className="cursor-pointer">
                <BiLabel en="Requires periodic inspection" pt="Exige inspeção periódica" size="small" />
              </Label>
              <Switch
                checked={!!form.requires_inspection}
                onCheckedChange={(v) => setForm({ ...form, requires_inspection: v ? 1 : 0 })}
              />
            </div>

            <div className="space-y-1 col-span-2">
              <Label><BiLabel en="Notes" pt="Observações" size="small" /></Label>
              <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              <BiLabel en="Cancel" pt="Cancelar" size="small" />
            </Button>
            <Button onClick={save}>
              <BiLabel en="Save" pt="Salvar" size="small" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick View Dialog */}
      <Dialog open={!!quickView} onOpenChange={(o) => !o && setQuickView(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <BiLabel en="Quick View" pt="Visualização Rápida" />
            </DialogTitle>
          </DialogHeader>
          {quickView && (
            <div className="flex flex-col items-center gap-4">
              {quickView.photo_url ? (
                <img src={quickView.photo_url} alt={quickView.name} className="h-60 w-60 rounded-lg object-cover border" />
              ) : (
                <div className="h-60 w-60 rounded-lg bg-muted flex items-center justify-center border">
                  <Eye className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="text-center space-y-2 w-full">
                <h3 className="text-lg font-bold">{quickView.name}</h3>
                {quickView.model && (
                  <div>
                    <BiLabel en="Model" pt="Modelo" size="small" className="items-center" />
                    <p className="text-sm">{quickView.model}</p>
                  </div>
                )}
                {quickView.notes && (
                  <div>
                    <BiLabel en="Notes" pt="Observações" size="small" className="items-center" />
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quickView.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk duplicate dialog */}
      <Dialog open={!!batchSource} onOpenChange={(o) => !o && setBatchSource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <BiLabel en="Duplicate in batch" pt="Duplicar em lote" />
            </DialogTitle>
          </DialogHeader>
          {batchSource && (
            <div className="space-y-3">
              <div className="text-sm">
                <BiLabel
                  en={`Source: ${batchSource.name} (${batchSource.code})`}
                  pt={`Origem: ${batchSource.name} (${batchSource.code})`}
                  size="small"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  <BiLabel en="How many to create" pt="Quantos criar" size="small" />
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={batchQty}
                  onChange={(e) => setBatchQty(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="space-y-1">
                <Label>
                  <BiLabel
                    en="TAGs (4 digits, one per line)"
                    pt="TAGs (4 dígitos, um por linha)"
                    size="small"
                  />
                </Label>
                <Textarea
                  rows={6}
                  value={batchTags}
                  onChange={(e) => setBatchTags(e.target.value)}
                  placeholder={`0001\n0002\n0003`}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  <BiLabel
                    en={`Must have exactly ${batchQty} line(s) of 4 digits`}
                    pt={`Deve ter exatamente ${batchQty} linha(s) de 4 dígitos`}
                    size="small"
                  />
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchSource(null)}>
              <BiLabel en="Cancel" pt="Cancelar" size="small" />
            </Button>
            <Button
              onClick={() => {
                if (!batchSource) return;
                const tags = batchTags
                  .split("\n")
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0);
                if (batchQty < 1) {
                  toast.error("Quantity must be ≥ 1 / Quantidade ≥ 1");
                  return;
                }
                if (tags.length !== batchQty) {
                  toast.error(
                    `Expected ${batchQty} TAG(s), got ${tags.length} / Esperado ${batchQty}, recebido ${tags.length}`,
                  );
                  return;
                }
                if (!tags.every((t) => /^\d{4}$/.test(t))) {
                  toast.error("Each TAG must be 4 digits / Cada TAG deve ter 4 dígitos");
                  return;
                }
                const src = batchSource;
                let baseNum = parseInt(nextCode(), 10);
                for (const tag of tags) {
                  const newCode = String(baseNum).padStart(5, "0");
                  baseNum += 1;
                  run(
                    `INSERT INTO tools (id, code, name, brand, model, type, serial_tag, tag, category, status, acquisition_date, value_eur, quantity, notes, photo_url, requires_calibration, requires_inspection)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [
                      uid(),
                      newCode,
                      src.name,
                      src.brand,
                      src.model,
                      src.type,
                      src.serial_tag,
                      tag,
                      src.category,
                      "available",
                      src.acquisition_date,
                      src.value_eur ?? 0,
                      1,
                      src.notes,
                      src.photo_url,
                      src.requires_calibration,
                      src.requires_inspection,
                    ],
                  );
                }
                toast.success(
                  `${tags.length} tools created / ${tags.length} ferramentas criadas`,
                );
                setBatchSource(null);
                bump();
              }}
            >
              <BiLabel en="Create batch" pt="Criar lote" size="small" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
