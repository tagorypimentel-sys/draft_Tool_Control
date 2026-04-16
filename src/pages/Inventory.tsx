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
import { Plus, Pencil, Search, Upload, X, Eye } from "lucide-react";
import { all, run, uid } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";

type Tool = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  serial_tag: string | null;
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
  category: "Tool",
  status: "available",
  value_eur: 0,
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Tool>>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [quickView, setQuickView] = useState<Tool | null>(null);

  const tools = useMemo(() => {
    void version;
    return all<Tool>("SELECT * FROM tools ORDER BY created_at DESC");
  }, [version]);

  const filtered = tools.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
    if (editId) {
      run(
        `UPDATE tools SET code=?, name=?, brand=?, model=?, type=?, serial_tag=?, category=?, status=?, acquisition_date=?, value_eur=?, quantity=?, notes=?, photo_url=?, requires_calibration=?, requires_inspection=? WHERE id=?`,
        [form.code, form.name, form.brand || null, form.model || null, form.type || null, form.serial_tag || null,
         form.category || null, form.status || "available",
         form.acquisition_date || null, Number(form.value_eur) || 0, Number(form.quantity) || 1,
         form.notes || null, form.photo_url || null,
         form.requires_calibration ? 1 : 0, form.requires_inspection ? 1 : 0, editId]
      );
      toast.success("Tool updated / Ferramenta atualizada");
    } else {
      run(
        `INSERT INTO tools (id, code, name, brand, model, type, serial_tag, category, status, acquisition_date, value_eur, quantity, notes, photo_url, requires_calibration, requires_inspection)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uid(), form.code, form.name, form.brand || null, form.model || null, form.type || null, form.serial_tag || null,
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
      <div className="flex items-center justify-between">
        <BiLabel en="Inventory" pt="Inventário" />
        <Button onClick={openNew}>
          <Plus />
          <BiLabel en="Add tool" pt="Adicionar ferramenta" size="small" />
        </Button>
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
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status / Todos</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.v} value={s.v}>{s.en} / {s.pt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><BiLabel en="Photo" pt="Foto" size="table" /></TableHead>
              <TableHead><BiLabel en="Code" pt="Código" size="table" /></TableHead>
              <TableHead><BiLabel en="Name" pt="Nome" size="table" /></TableHead>
              <TableHead><BiLabel en="Brand" pt="Marca" size="table" /></TableHead>
              <TableHead><BiLabel en="Category" pt="Categoria" size="table" /></TableHead>
              <TableHead><BiLabel en="Type" pt="Tipo" size="table" /></TableHead>
              <TableHead><BiLabel en="Serial/TAG" pt="Série/TAG" size="table" /></TableHead>
              <TableHead><BiLabel en="Status" pt="Status" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Qty" pt="Qtd" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Value" pt="Valor" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Actions" pt="Ações" size="table" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-10">
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
                  <TableCell className="font-mono text-sm">{t.code}</TableCell>
                  <TableCell className="font-medium">
                    {t.name}
                    {(t.requires_calibration || t.requires_inspection) ? (
                      <div className="flex gap-1 mt-1">
                        {t.requires_calibration ? (
                          <span className="text-[9px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1 rounded">CAL</span>
                        ) : null}
                        {t.requires_inspection ? (
                          <span className="text-[9px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1 rounded">INSP</span>
                        ) : null}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{t.brand || "—"}</TableCell>
                  <TableCell>{t.category || "—"}</TableCell>
                  <TableCell>{t.type || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{t.serial_tag || "—"}</TableCell>
                  <TableCell>{statusBadge(t.status)}</TableCell>
                  <TableCell className="text-right">
                    {t.quantity}
                    {t.quantity_out_of_service > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">({t.quantity_out_of_service})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatEUR(t.value_eur)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setQuickView(t)} title="Quick view">
                        <Eye className="h-4 w-4" />
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
              <Label><BiLabel en="Model" pt="Modelo" size="small" /></Label>
              <Input value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Serial/TAG" pt="Série/TAG" size="small" /></Label>
              <Input value={form.serial_tag || ""} onChange={(e) => setForm({ ...form, serial_tag: e.target.value })} />
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
                  value={form.value_eur ?? 0}
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
    </div>
  );
};

export default Inventory;
