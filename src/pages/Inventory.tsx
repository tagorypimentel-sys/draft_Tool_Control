import { useState, useMemo } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Search } from "lucide-react";
import { all, run, uid } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";

type Tool = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  location: string | null;
  status: string;
  acquisition_date: string | null;
  value_eur: number | null;
  notes: string | null;
};

const STATUSES: { v: string; en: string; pt: string; cls: string }[] = [
  { v: "available", en: "Available", pt: "Disponível", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { v: "in_use", en: "In use", pt: "Em uso", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { v: "maintenance", en: "Maintenance", pt: "Manutenção", cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  { v: "calibration", en: "Calibration", pt: "Calibração", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { v: "retired", en: "Retired", pt: "Baixada", cls: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
];

const empty: Partial<Tool> = { code: "", name: "", category: "", location: "", status: "available", value_eur: 0, notes: "" };

const Inventory = () => {
  const { version, bump } = useDb();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Tool>>(empty);
  const [editId, setEditId] = useState<string | null>(null);

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
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (t: Tool) => {
    setEditId(t.id);
    setForm(t);
    setOpen(true);
  };

  const save = () => {
    if (!form.code || !form.name) {
      toast.error("Code and Name are required / Código e Nome obrigatórios");
      return;
    }
    if (editId) {
      run(
        `UPDATE tools SET code=?, name=?, category=?, location=?, status=?, acquisition_date=?, value_eur=?, notes=? WHERE id=?`,
        [form.code, form.name, form.category || null, form.location || null, form.status || "available",
         form.acquisition_date || null, Number(form.value_eur) || 0, form.notes || null, editId]
      );
      toast.success("Tool updated / Ferramenta atualizada");
    } else {
      run(
        `INSERT INTO tools (id, code, name, category, location, status, acquisition_date, value_eur, notes) VALUES (?,?,?,?,?,?,?,?,?)`,
        [uid(), form.code, form.name, form.category || null, form.location || null, form.status || "available",
         form.acquisition_date || null, Number(form.value_eur) || 0, form.notes || null]
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
              <TableHead><BiLabel en="Code" pt="Código" size="table" /></TableHead>
              <TableHead><BiLabel en="Name" pt="Nome" size="table" /></TableHead>
              <TableHead><BiLabel en="Category" pt="Categoria" size="table" /></TableHead>
              <TableHead><BiLabel en="Location" pt="Local" size="table" /></TableHead>
              <TableHead><BiLabel en="Status" pt="Status" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Value" pt="Valor" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Actions" pt="Ações" size="table" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <BiLabel en="No tools found" pt="Nenhuma ferramenta encontrada" className="items-center" />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">{t.code}</TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.category || "—"}</TableCell>
                  <TableCell>{t.location || "—"}</TableCell>
                  <TableCell>{statusBadge(t.status)}</TableCell>
                  <TableCell className="text-right">{formatEUR(t.value_eur)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Select value={t.status} onValueChange={(v) => changeStatus(t, v)}>
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s.v} value={s.v}>{s.en} / {s.pt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <BiLabel en={editId ? "Edit tool" : "Add tool"} pt={editId ? "Editar ferramenta" : "Adicionar ferramenta"} />
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label><BiLabel en="Code" pt="Código" size="small" /></Label>
              <Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Name" pt="Nome" size="small" /></Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Category" pt="Categoria" size="small" /></Label>
              <Input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Location" pt="Local" size="small" /></Label>
              <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
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
    </div>
  );
};

export default Inventory;
