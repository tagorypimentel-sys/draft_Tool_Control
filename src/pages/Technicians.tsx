import { useState, useMemo } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { all, run, uid } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import { toast } from "sonner";

type Tech = { id: string; name: string; email: string | null; contact: string | null };

const Technicians = () => {
  const { version, bump } = useDb();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Tech>>({ name: "", email: "", contact: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const list = useMemo(() => {
    void version;
    return all<Tech>("SELECT * FROM technicians ORDER BY name");
  }, [version]);

  const openNew = () => { 
    setEditId(null); 
    setForm({ name: "", email: "", contact: "" }); 
    setOpen(true); 
  };
  
  const openEdit = (t: Tech) => { 
    setEditId(t.id); 
    setForm(t); 
    setOpen(true); 
  };

  const save = () => {
    if (!form.name) { 
      toast.error("Name required / Nome obrigatório"); 
      return; 
    }
    
    if (editId) {
      run("UPDATE technicians SET name=?, email=?, contact=? WHERE id=?",
        [form.name, form.email || null, form.contact || null, editId]);
      toast.success("Updated / Atualizado");
    } else {
      run("INSERT INTO technicians (id, name, email, contact) VALUES (?,?,?,?)",
        [uid(), form.name, form.email || null, form.contact || null]);
      toast.success("Added / Adicionado");
    }
    setOpen(false); 
    bump();
  };

  const remove = (id: string) => {
    if (confirm("Are you sure? / Tem certeza?")) {
      run("DELETE FROM technicians WHERE id=?", [id]);
      bump();
      toast.success("Removed / Removido");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <BiLabel en="Technician Register" pt="Cadastro de Técnicos" />
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          <BiLabel en="Add" pt="Adicionar" size="small" />
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><BiLabel en="Name" pt="Nome" size="table" /></TableHead>
              <TableHead><BiLabel en="Email" pt="Correio Eletrônico" size="table" /></TableHead>
              <TableHead><BiLabel en="Contact" pt="Contato" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Actions" pt="Ações" size="table" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.email || "—"}</TableCell>
                <TableCell>{t.contact || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <BiLabel en={editId ? "Edit technician" : "Add technician"} pt={editId ? "Editar técnico" : "Adicionar técnico"} />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label><BiLabel en="Name" pt="Nome" size="small" /></Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Email" pt="Correio Eletrônico" size="small" /></Label>
              <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Contact" pt="Contato" size="small" /></Label>
              <Input value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
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

export default Technicians;
