import React, { useState, useMemo } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { all, run, uid } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import { toast } from "sonner";

type Client = { id: string; name: string; contact: string | null; email: string | null };

const Clients = () => {
  const { version, bump } = useDb();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({ name: "", contact: "", email: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const list = useMemo(() => {
    void version;
    return all<Client>("SELECT * FROM clients ORDER BY name");
  }, [version]);

  const openNew = () => { 
    setEditId(null); 
    setForm({ name: "", contact: "", email: "" }); 
    setOpen(true); 
  };
  
  const openEdit = (c: Client) => { 
    setEditId(c.id); 
    setForm(c); 
    setOpen(true); 
  };

  const save = () => {
    if (!form.name) { 
      toast.error("Name required / Nome obrigatório"); 
      return; 
    }
    
    if (editId) {
      run("UPDATE clients SET name=?, contact=?, email=? WHERE id=?",
        [form.name, form.contact || null, form.email || null, editId]);
      toast.success("Updated / Atualizado");
    } else {
      run("INSERT INTO clients (id, name, contact, email) VALUES (?,?,?,?)",
        [uid(), form.name, form.contact || null, form.email || null]);
      toast.success("Added / Adicionado");
    }
    setOpen(false); 
    bump();
  };

  const remove = (id: string) => {
    if (confirm("Are you sure? / Tem certeza?")) {
      run("DELETE FROM clients WHERE id=?", [id]);
      bump();
      toast.success("Removed / Removido");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <BiLabel en="Clients Register" pt="Cadastro de Clientes" />
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          <BiLabel en="Add" pt="Adicionar" size="small" />
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><BiLabel en="Client Name" pt="Nome do Cliente" size="table" /></TableHead>
              <TableHead><BiLabel en="Contact" pt="Contato" size="table" /></TableHead>
              <TableHead><BiLabel en="Email" pt="Correio Eletrônico" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Actions" pt="Ações" size="table" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        <BiLabel en="No clients found" pt="Nenhum cliente encontrado" />
                    </TableCell>
                </TableRow>
            ) : (
                list.map((c) => (
                    <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.contact || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <BiLabel en={editId ? "Edit Client" : "Add Client"} pt={editId ? "Editar Cliente" : "Adicionar Cliente"} />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label><BiLabel en="Name" pt="Nome" size="small" /></Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Contact" pt="Contato" size="small" /></Label>
              <Input value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Email" pt="Email" size="small" /></Label>
              <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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

export default Clients;
