import { useMemo, useState } from "react";
import { BiLabel } from "@/components/BiLabel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Plus, Eye, Printer, FileDown, FileSpreadsheet, RotateCcw, AlertTriangle } from "lucide-react";
import { useDb } from "@/hooks/useDb";
import { all } from "@/lib/db";
import { format, differenceInDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NewCautelaDialog } from "@/components/movements/NewCautelaDialog";
import { ReturnDialog } from "@/components/movements/ReturnDialog";
import { CautelaDetailsDialog } from "@/components/movements/CautelaDetailsDialog";
import { exportCautelaPDF, exportCautelaExcel, printCautela } from "@/lib/cautela";

type Row = {
  id: string;
  number: string;
  project: string;
  client: string | null;
  ship: string | null;
  date_out: string;
  date_in: string | null;
  status: string;
  technician_name: string | null;
};

const STATUS_LABELS: Record<string, { en: string; pt: string; cls: string }> = {
  open: { en: "Open", pt: "Aberta", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  partial: { en: "Partial", pt: "Parcial", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  closed: { en: "Closed", pt: "Fechada", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
};

const Movements = () => {
  const { version, bump } = useDb();
  const [newOpen, setNewOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnCautelaId, setReturnCautelaId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const categories = useMemo(() => {
    void version;
    return all<{ category: string }>(
      "SELECT DISTINCT category FROM tools WHERE category IS NOT NULL AND category != '' ORDER BY category"
    ).map((r) => r.category);
  }, [version]);

  const types = useMemo(() => {
    void version;
    return all<{ type: string }>(
      "SELECT DISTINCT type FROM tools WHERE type IS NOT NULL AND type != '' ORDER BY type"
    ).map((r) => r.type);
  }, [version]);

  const overdueDays = useMemo(() => {
    void version;
    const row = all<{ value: string | null }>("SELECT value FROM settings WHERE key = 'overdue_days'");
    return row.length > 0 && row[0].value ? parseInt(row[0].value, 10) : 20;
  }, [version]);

  const rows = useMemo(() => {
    void version;
    const conds: string[] = [];
    if (statusFilter === "active") conds.push("c.status IN ('open','partial')");
    else if (statusFilter !== "all") conds.push(`c.status = '${statusFilter}'`);
    if (categoryFilter !== "all") {
      conds.push(`EXISTS (SELECT 1 FROM cautela_items ci JOIN tools tl ON tl.id = ci.tool_id WHERE ci.cautela_id = c.id AND tl.category = '${categoryFilter.replace(/'/g, "''")}')`);
    }
    if (typeFilter !== "all") {
      conds.push(`EXISTS (SELECT 1 FROM cautela_items ci JOIN tools tl ON tl.id = ci.tool_id WHERE ci.cautela_id = c.id AND tl.type = '${typeFilter.replace(/'/g, "''")}')`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    return all<Row>(
      `SELECT c.*, t.name as technician_name
       FROM cautelas c
       LEFT JOIN technicians t ON t.id = c.technician_id
       ${where}
       ORDER BY c.created_at DESC`
    );
  }, [version, statusFilter, categoryFilter, typeFilter]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.number.toLowerCase().includes(s) ||
      r.project.toLowerCase().includes(s) ||
      (r.technician_name || "").toLowerCase().includes(s) ||
      (r.client || "").toLowerCase().includes(s) ||
      (r.ship || "").toLowerCase().includes(s)
    );
  });

  const statusBadge = (s: string) => {
    const f = STATUS_LABELS[s] || STATUS_LABELS.open;
    return (
      <span className={`inline-flex flex-col items-start px-2 py-0.5 rounded text-[11px] ${f.cls}`}>
        <span className="font-bold leading-tight">{f.en}</span>
        <span className="italic text-[9px] leading-tight opacity-80">{f.pt}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <BiLabel en="Movements" pt="Movimentações" />
        <div className="flex gap-2">
          <Button onClick={() => setNewOpen(true)}>
            <Plus />
            <BiLabel en="New Checkout" pt="Nova Saída" size="small" />
          </Button>
          <Button variant="outline" onClick={() => { setReturnCautelaId(null); setReturnOpen(true); }}>
            <RotateCcw />
            <BiLabel en="Return Items" pt="Devolver Material" size="small" />
          </Button>
        </div>
      </div>

      <Card className="p-4 flex gap-3 flex-wrap">
        <Input
          placeholder="Search / Buscar (#, project, technician...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active / Ativas (open+partial)</SelectItem>
            <SelectItem value="open">Open / Aberta</SelectItem>
            <SelectItem value="partial">Partial / Parcial</SelectItem>
            <SelectItem value="closed">Closed / Fechada</SelectItem>
            <SelectItem value="all">All / Todas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category / Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories / Todas Categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type / Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types / Todos Tipos</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><BiLabel en="Number" pt="Nº" size="table" /></TableHead>
              <TableHead><BiLabel en="Project" pt="Projeto" size="table" /></TableHead>
              <TableHead><BiLabel en="Technician" pt="Técnico" size="table" /></TableHead>
              <TableHead><BiLabel en="Client" pt="Cliente" size="table" /></TableHead>
              <TableHead><BiLabel en="Ship" pt="Navio" size="table" /></TableHead>
              <TableHead><BiLabel en="Date Out" pt="Saída" size="table" /></TableHead>
              <TableHead><BiLabel en="Status" pt="Status" size="table" /></TableHead>
              <TableHead className="text-right"><BiLabel en="Actions" pt="Ações" size="table" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <BiLabel en="No cautelas found" pt="Nenhuma cautela encontrada" className="items-center" />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const isOverdue = r.status !== "closed" && differenceInDays(new Date(), new Date(r.date_out)) > overdueDays;
                return (
                <TableRow key={r.id} className={isOverdue ? "bg-red-50 dark:bg-red-950/30" : ""}>
                  <TableCell className="font-mono text-xs font-bold">
                    <span className="flex items-center gap-1">
                      {r.number}
                      {isOverdue && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <BiLabel en={`Overdue (>${overdueDays} days)`} pt={`Atrasada (>${overdueDays} dias)`} size="small" />
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{r.project}</TableCell>
                  <TableCell>{r.technician_name || "—"}</TableCell>
                  <TableCell>{r.client || "—"}</TableCell>
                  <TableCell>{r.ship || "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(r.date_out), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" title="Details / Detalhes" onClick={() => setDetailsId(r.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Print / Imprimir" onClick={() => printCautela(r.id)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="PDF" onClick={() => exportCautelaPDF(r.id)}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excel" onClick={() => exportCautelaExcel(r.id)}>
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>
                      {r.status !== "closed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Return / Devolver"
                          onClick={() => { setReturnCautelaId(r.id); setReturnOpen(true); }}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <NewCautelaDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => {
          bump();
          setDetailsId(id);
        }}
      />
      <ReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        onReturned={() => bump()}
        initialCautelaId={returnCautelaId}
      />
      <CautelaDetailsDialog
        cautelaId={detailsId}
        onOpenChange={(o) => { if (!o) setDetailsId(null); }}
      />
    </div>
  );
};

export default Movements;
