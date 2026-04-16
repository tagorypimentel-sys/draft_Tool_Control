import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { all, exec } from "@/lib/db";
import { toast } from "sonner";

type Cautela = {
  id: string;
  number: string;
  project: string;
  technician_id: string;
  technician_name: string;
};

type PendingItem = {
  item_id: string;
  cautela_id: string;
  cautela_number: string;
  tool_id: string;
  tool_name: string;
  tool_code: string;
  qty_out: number;
  qty_returned: number;
  qty_out_of_service: number;
  pending: number;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onReturned: () => void;
  initialCautelaId?: string | null;
}

type RowState = {
  qty: number;
  condition: "in_use" | "out_of_service";
  notes: string;
};

export function ReturnDialog({ open, onOpenChange, onReturned, initialCautelaId }: Props) {
  const [filterTech, setFilterTech] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterNumber, setFilterNumber] = useState("");
  const [items, setItems] = useState<PendingItem[]>([]);
  const [state, setState] = useState<Record<string, RowState>>({});
  const [confirmFullCautelaId, setConfirmFullCautelaId] = useState<string | null>(null);

  const loadItems = () => {
    let sql = `
      SELECT ci.id as item_id, ci.cautela_id, c.number as cautela_number,
             ci.tool_id, t.name as tool_name, t.code as tool_code,
             ci.qty_out, ci.qty_returned, ci.qty_out_of_service,
             (ci.qty_out - ci.qty_returned - ci.qty_out_of_service) as pending,
             tech.name as tech_name, c.project as project
      FROM cautela_items ci
      JOIN cautelas c ON c.id = ci.cautela_id
      JOIN tools t ON t.id = ci.tool_id
      LEFT JOIN technicians tech ON tech.id = c.technician_id
      WHERE c.status IN ('open','partial')
        AND (ci.qty_out - ci.qty_returned - ci.qty_out_of_service) > 0
    `;
    const params: any[] = [];
    if (initialCautelaId) {
      sql += " AND c.id = ?";
      params.push(initialCautelaId);
    }
    if (filterTech) {
      sql += " AND LOWER(tech.name) LIKE ?";
      params.push(`%${filterTech.toLowerCase()}%`);
    }
    if (filterProject) {
      sql += " AND LOWER(c.project) LIKE ?";
      params.push(`%${filterProject.toLowerCase()}%`);
    }
    if (filterNumber) {
      sql += " AND LOWER(c.number) LIKE ?";
      params.push(`%${filterNumber.toLowerCase()}%`);
    }
    sql += " ORDER BY c.number, t.name";
    setItems(all<PendingItem>(sql, params));
  };

  useEffect(() => {
    if (!open) return;
    setFilterTech("");
    setFilterProject("");
    setFilterNumber("");
    setState({});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filterTech, filterProject, filterNumber, initialCautelaId]);

  const grouped = useMemo(() => {
    const map = new Map<string, { number: string; rows: PendingItem[] }>();
    for (const it of items) {
      if (!map.has(it.cautela_id))
        map.set(it.cautela_id, { number: it.cautela_number, rows: [] });
      map.get(it.cautela_id)!.rows.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const setRow = (id: string, patch: Partial<RowState>) => {
    setState((p) => ({
      ...p,
      [id]: { qty: 0, condition: "in_use", notes: "", ...p[id], ...patch },
    }));
  };

  const submit = (overrideState?: Record<string, RowState>) => {
    const effective = overrideState ?? state;
    const ops: { sql: string; params?: any[] }[] = [];
    let any = false;
    const touchedCautelas = new Set<string>();

    for (const it of items) {
      const s = effective[it.item_id];
      if (!s || !s.qty || s.qty <= 0) continue;
      if (s.qty > it.pending) {
        toast.error(`Qty exceeds pending for ${it.tool_name}`);
        return;
      }
      if (s.condition === "out_of_service" && !s.notes.trim()) {
        toast.error(`Notes required for out-of-service: ${it.tool_name}`);
        return;
      }
      any = true;
      touchedCautelas.add(it.cautela_id);

      if (s.condition === "in_use") {
        ops.push({
          sql: "UPDATE cautela_items SET qty_returned = qty_returned + ? WHERE id=?",
          params: [s.qty, it.item_id],
        });
        ops.push({
          sql: "UPDATE tools SET quantity = quantity + ?, status='available' WHERE id=?",
          params: [s.qty, it.tool_id],
        });
      } else {
        ops.push({
          sql: `UPDATE cautela_items
                SET qty_out_of_service = qty_out_of_service + ?,
                    condition_notes = COALESCE(condition_notes || ' | ', '') || ?
                WHERE id=?`,
          params: [s.qty, s.notes.trim(), it.item_id],
        });
        ops.push({
          sql: "UPDATE tools SET quantity_out_of_service = quantity_out_of_service + ? WHERE id=?",
          params: [s.qty, it.tool_id],
        });
      }
    }

    if (!any) {
      toast.error("Nothing to return / Nada a devolver");
      return;
    }

    exec(ops);

    // Recalc each touched cautela status
    for (const cid of touchedCautelas) {
      const pending = all<{ p: number }>(
        `SELECT SUM(qty_out - qty_returned - qty_out_of_service) as p
         FROM cautela_items WHERE cautela_id = ?`,
        [cid]
      )[0]?.p ?? 0;
      if (pending <= 0) {
        exec([
          {
            sql: "UPDATE cautelas SET status='closed', date_in=? WHERE id=?",
            params: [new Date().toISOString(), cid],
          },
        ]);
      } else {
        exec([{ sql: "UPDATE cautelas SET status='partial' WHERE id=?", params: [cid] }]);
      }
    }

    toast.success("Return recorded / Devolução registrada");
    onOpenChange(false);
    onReturned();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <BiLabel en="Return Items" pt="Devolver Material" />
          </DialogTitle>
        </DialogHeader>

        {!initialCautelaId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label><BiLabel en="Technician" pt="Técnico" size="small" /></Label>
              <Input value={filterTech} onChange={(e) => setFilterTech(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Project" pt="Projeto" size="small" /></Label>
              <Input value={filterProject} onChange={(e) => setFilterProject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Cautela #" pt="Nº Cautela" size="small" /></Label>
              <Input value={filterNumber} onChange={(e) => setFilterNumber(e.target.value)} />
            </div>
          </div>
        )}

        <div className="space-y-4 mt-2">
          {grouped.length === 0 && (
            <Card className="p-6 text-center">
              <BiLabel en="No pending items" pt="Sem itens pendentes" className="items-center" />
            </Card>
          )}
          {grouped.map(([cid, g]) => (
            <Card key={cid} className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm">Cautela {g.number}</div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmFullCautelaId(cid)}
                >
                  <CheckCheck className="h-4 w-4" />
                  <BiLabel en="Return Full" pt="Devolver Completa" size="small" />
                </Button>
              </div>
              <div className="space-y-2">
                {g.rows.map((it) => {
                  const s = state[it.item_id] || { qty: 0, condition: "in_use" as const, notes: "" };
                  return (
                    <div key={it.item_id} className="grid grid-cols-12 gap-2 items-start border-t pt-2">
                      <div className="col-span-12 md:col-span-4">
                        <div className="font-medium text-sm">{it.tool_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{it.tool_code}</div>
                        <div className="text-xs">
                          <BiLabel en={`Pending: ${it.pending}`} pt={`Pendente: ${it.pending}`} size="small" />
                        </div>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-xs"><BiLabel en="Qty returning" pt="Qtd devolver" size="small" /></Label>
                        <Input
                          type="number"
                          min={0}
                          max={it.pending}
                          value={s.qty || ""}
                          onChange={(e) =>
                            setRow(it.item_id, { qty: parseInt(e.target.value, 10) || 0 })
                          }
                          className="h-8"
                        />
                      </div>
                      <div className="col-span-8 md:col-span-3">
                        <Label className="text-xs"><BiLabel en="Condition" pt="Condição" size="small" /></Label>
                        <RadioGroup
                          value={s.condition}
                          onValueChange={(v) => setRow(it.item_id, { condition: v as any })}
                          className="flex gap-3 mt-1"
                        >
                          <div className="flex items-center gap-1">
                            <RadioGroupItem value="in_use" id={`${it.item_id}-in`} />
                            <Label htmlFor={`${it.item_id}-in`} className="text-xs cursor-pointer">
                              <BiLabel en="In use" pt="Em uso" size="small" />
                            </Label>
                          </div>
                          <div className="flex items-center gap-1">
                            <RadioGroupItem value="out_of_service" id={`${it.item_id}-out`} />
                            <Label htmlFor={`${it.item_id}-out`} className="text-xs cursor-pointer">
                              <BiLabel en="Out of service" pt="Fora de uso" size="small" />
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        {s.condition === "out_of_service" && (
                          <>
                            <Label className="text-xs"><BiLabel en="Notes" pt="Observações" size="small" /></Label>
                            <Textarea
                              value={s.notes}
                              onChange={(e) => setRow(it.item_id, { notes: e.target.value })}
                              className="h-16"
                              placeholder="Required / Obrigatório"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <BiLabel en="Cancel" pt="Cancelar" size="small" />
          </Button>
          <Button onClick={() => submit()}>
            <BiLabel en="Confirm Return" pt="Confirmar Devolução" size="small" />
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={!!confirmFullCautelaId}
        onOpenChange={(o) => !o && setConfirmFullCautelaId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <BiLabel en="Return entire cautela?" pt="Devolver cautela inteira?" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <BiLabel
                en="Confirm that ALL items being returned are in working condition."
                pt="Confirme que TODOS os itens devolvidos estão em condições de uso."
                size="small"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <BiLabel en="Cancel" pt="Cancelar" size="small" />
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const cid = confirmFullCautelaId;
                if (!cid) return;
                const override: Record<string, RowState> = { ...state };
                for (const it of items) {
                  if (it.cautela_id !== cid) continue;
                  if (it.pending <= 0) continue;
                  override[it.item_id] = {
                    qty: it.pending,
                    condition: "in_use",
                    notes: "",
                  };
                }
                setState(override);
                setConfirmFullCautelaId(null);
                submit(override);
              }}
            >
              <BiLabel en="Confirm" pt="Confirmar" size="small" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
