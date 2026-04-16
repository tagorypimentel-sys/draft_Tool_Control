import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BiLabel } from "@/components/BiLabel";
import { all, exec, uid } from "@/lib/db";
import { formatEUR } from "@/lib/format";
import { generateCautelaNumber } from "@/lib/cautela";
import { toast } from "sonner";
import { Search } from "lucide-react";

type Tech = { id: string; name: string };
type Tool = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  type: string | null;
  serial_tag: string | null;
  quantity: number;
  value_eur: number | null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (cautelaId: string, number: string) => void;
}

export function NewCautelaDialog({ open, onOpenChange, onCreated }: Props) {
  const [technicians, setTechnicians] = useState<Tech[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [techName, setTechName] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [project, setProject] = useState("");
  const [client, setClient] = useState("");
  const [ship, setShip] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setTechnicians(all<Tech>("SELECT id, name FROM technicians ORDER BY name"));
    setTools(
      all<Tool>(
        "SELECT id, code, name, brand, category, type, serial_tag, quantity, value_eur FROM tools WHERE status='available' AND quantity > 0 ORDER BY name"
      )
    );
    setTechName("");
    setDeliveredBy("");
    setProject("");
    setClient("");
    setShip("");
    setSearch("");
    setSelected({});
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return tools;
    const s = search.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.code.toLowerCase().includes(s) ||
        (t.brand || "").toLowerCase().includes(s) ||
        (t.serial_tag || "").toLowerCase().includes(s)
    );
  }, [tools, search]);

  const totals = useMemo(() => {
    let count = 0;
    let value = 0;
    for (const t of tools) {
      const q = selected[t.id] || 0;
      if (q > 0) {
        count += q;
        value += q * (t.value_eur || 0);
      }
    }
    return { count, value };
  }, [selected, tools]);

  const toggle = (t: Tool, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[t.id] = next[t.id] || 1;
      else delete next[t.id];
      return next;
    });
  };
  const setQty = (t: Tool, qty: number) => {
    const clamped = Math.max(1, Math.min(qty || 1, t.quantity));
    setSelected((prev) => ({ ...prev, [t.id]: clamped }));
  };
  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const t of filtered) if (!next[t.id]) next[t.id] = 1;
      return next;
    });
  };
  const clearAll = () => setSelected({});

  const save = () => {
    const name = techName.trim();
    if (!name) return toast.error("Enter technician / Informe o técnico");
    if (!project.trim()) return toast.error("Project required / Projeto obrigatório");
    const items = tools.filter((t) => (selected[t.id] || 0) > 0);
    if (items.length === 0) return toast.error("Select at least one tool / Selecione ao menos uma ferramenta");

    // Find or create technician by name (case-insensitive)
    const existing = technicians.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const techId = existing ? existing.id : uid();

    const cautelaId = uid();
    const number = generateCautelaNumber(project);
    const now = new Date().toISOString();

    const ops: { sql: string; params?: any[] }[] = [];
    if (!existing) {
      ops.push({
        sql: `INSERT INTO technicians (id, name) VALUES (?, ?)`,
        params: [techId, name],
      });
    }
    ops.push({
      sql: `INSERT INTO cautelas (id, number, project, client, ship, technician_id, date_out, status)
            VALUES (?,?,?,?,?,?,?, 'open')`,
      params: [cautelaId, number, project.trim(), client || null, ship || null, techId, now],
    });
    for (const t of items) {
      const qty = selected[t.id];
      ops.push({
        sql: `INSERT INTO cautela_items (id, cautela_id, tool_id, qty_out, unit_value_eur)
              VALUES (?,?,?,?,?)`,
        params: [uid(), cautelaId, t.id, qty, t.value_eur || 0],
      });
      const newQty = t.quantity - qty;
      if (newQty <= 0) {
        ops.push({
          sql: "UPDATE tools SET quantity=0, status='out' WHERE id=?",
          params: [t.id],
        });
      } else {
        ops.push({
          sql: "UPDATE tools SET quantity=? WHERE id=?",
          params: [newQty, t.id],
        });
      }
    }
    exec(ops);
    toast.success(`Cautela ${number} created / criada`);
    onOpenChange(false);
    onCreated(cautelaId, number);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <BiLabel en="New Checkout (Cautela)" pt="Nova Saída (Cautela)" />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1 col-span-2 md:col-span-1">
            <Label><BiLabel en="Technician/Supervisor" pt="Técnico/Supervisor" size="small" /></Label>
            <Input
              list="tech-suggestions"
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              placeholder=""
            />
            <datalist id="tech-suggestions">
              {technicians.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label><BiLabel en="Project Number" pt="Nº Projeto" size="small" /></Label>
            <Input value={project} onChange={(e) => setProject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label><BiLabel en="Client" pt="Cliente" size="small" /></Label>
            <Input value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label><BiLabel en="Ship" pt="Navio" size="small" /></Label>
            <Input value={ship} onChange={(e) => setShip(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 items-center mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools / Buscar ferramentas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={selectAllFiltered}>
            <BiLabel en="Select all filtered" pt="Selecionar todos filtrados" size="small" />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <BiLabel en="Clear" pt="Limpar" size="small" />
          </Button>
        </div>

        <div className="border rounded-md max-h-[40vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead><BiLabel en="Code" pt="Código" size="table" /></TableHead>
                <TableHead><BiLabel en="Name" pt="Nome" size="table" /></TableHead>
                <TableHead><BiLabel en="Brand" pt="Marca" size="table" /></TableHead>
                <TableHead><BiLabel en="Category" pt="Categoria" size="table" /></TableHead>
                <TableHead><BiLabel en="Type" pt="Tipo" size="table" /></TableHead>
                <TableHead><BiLabel en="Serial/TAG" pt="Série/TAG" size="table" /></TableHead>
                <TableHead className="text-right"><BiLabel en="Avail." pt="Disp." size="table" /></TableHead>
                <TableHead className="text-right"><BiLabel en="Qty" pt="Qtd" size="table" /></TableHead>
                <TableHead className="text-right"><BiLabel en="Unit €" pt="Unit. €" size="table" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-6">
                    <BiLabel en="No available tools" pt="Sem ferramentas disponíveis" className="items-center" />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => {
                  const isSel = !!selected[t.id];
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox checked={isSel} onCheckedChange={(c) => toggle(t, !!c)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.code}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.brand || "—"}</TableCell>
                      <TableCell>{t.category || "—"}</TableCell>
                      <TableCell>{t.type || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{t.serial_tag || "—"}</TableCell>
                      <TableCell className="text-right">{t.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={1}
                          max={t.quantity}
                          disabled={!isSel}
                          value={selected[t.id] || ""}
                          onChange={(e) => setQty(t, parseInt(e.target.value, 10))}
                          className="h-8 w-20 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatEUR(t.value_eur || 0)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center text-sm bg-muted/40 p-3 rounded-md">
          <BiLabel en={`Items selected: ${totals.count}`} pt={`Itens selecionados: ${totals.count}`} size="small" />
          <span className="font-semibold">{formatEUR(totals.value)}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <BiLabel en="Cancel" pt="Cancelar" size="small" />
          </Button>
          <Button onClick={save}>
            <BiLabel en="Create Cautela" pt="Criar Cautela" size="small" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
