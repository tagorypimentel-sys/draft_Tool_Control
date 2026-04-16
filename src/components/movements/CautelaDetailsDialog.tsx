import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BiLabel } from "@/components/BiLabel";
import { getCautelaWithItems } from "@/lib/cautela";
import { formatEUR } from "@/lib/format";
import { format } from "date-fns";

interface Props {
  cautelaId: string | null;
  onOpenChange: (o: boolean) => void;
}

export function CautelaDetailsDialog({ cautelaId, onOpenChange }: Props) {
  const data = cautelaId ? getCautelaWithItems(cautelaId) : null;

  return (
    <Dialog open={!!cautelaId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <BiLabel en={`Cautela ${data?.cautela.number || ""}`} pt={`Cautela ${data?.cautela.number || ""}`} />
          </DialogTitle>
        </DialogHeader>
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div><b>Date / Data:</b> {format(new Date(data.cautela.date_out), "dd/MM/yyyy")}</div>
              <div><b>Project / Projeto:</b> {data.cautela.project}</div>
              <div><b>Technician / Técnico:</b> {data.technician}</div>
              <div><b>Client / Cliente:</b> {data.cautela.client || "—"}</div>
              <div><b>Ship / Navio:</b> {data.cautela.ship || "—"}</div>
              <div><b>Status:</b> {data.cautela.status}</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><BiLabel en="Name" pt="Nome" size="table" /></TableHead>
                  <TableHead><BiLabel en="Brand" pt="Marca" size="table" /></TableHead>
                  <TableHead><BiLabel en="Serial/TAG" pt="Série/TAG" size="table" /></TableHead>
                  <TableHead className="text-right"><BiLabel en="Qty out" pt="Qtd saída" size="table" /></TableHead>
                  <TableHead className="text-right"><BiLabel en="Returned" pt="Devolvido" size="table" /></TableHead>
                  <TableHead className="text-right"><BiLabel en="Out of service" pt="Fora de uso" size="table" /></TableHead>
                  <TableHead className="text-right"><BiLabel en="Total €" pt="Total €" size="table" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell>{it.brand || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{it.serial_tag || "—"}</TableCell>
                    <TableCell className="text-right">{it.qty_out}</TableCell>
                    <TableCell className="text-right">{it.qty_returned}</TableCell>
                    <TableCell className="text-right">{it.qty_out_of_service}</TableCell>
                    <TableCell className="text-right">{formatEUR((it.unit_value_eur || 0) * it.qty_out)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
