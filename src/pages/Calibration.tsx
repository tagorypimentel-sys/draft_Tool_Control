import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Download, Eye, FileCheck, Pencil, Search, Wrench } from "lucide-react";
import { BiLabel } from "@/components/BiLabel";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDb } from "@/hooks/useDb";
import { useLanguage } from "@/hooks/useLanguage";
import { all } from "@/lib/db";
import { formatEUR } from "@/lib/format";
import {
  buildDaysRemainingLabel,
  CALIBRATION_STATUS_CLASSES,
  CALIBRATION_TYPE_OPTIONS,
  CalibrationRow,
  formatDateDisplay,
  getCalibrationBadgeLabel,
  getCalibrationRowStatus,
  getDaysRemaining,
  getFrequencyLabel,
} from "@/lib/calibration";
import { CalibrationViewDialog } from "@/components/calibration/CalibrationViewDialog";
import { CalibrationEditDialog } from "@/components/calibration/CalibrationEditDialog";

const STATUS_ORDER = { red: 0, never: 0, yellow: 1, green: 2 } as const;

const Calibration = () => {
  const { ready, version } = useDb();
  const { lang } = useLanguage();
  const [searchName, setSearchName] = useState("");
  const [searchBrand, setSearchBrand] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchSerial, setSearchSerial] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewToolId, setViewToolId] = useState<string | null>(null);
  const [editToolId, setEditToolId] = useState<string | null>(null);

  const rows = useMemo(() => {
    void version;
    if (!ready) return [] as CalibrationRow[];
    return all<CalibrationRow>(`
      SELECT
        v.*, t.type
      FROM v_calibration_status v
      JOIN tools t ON t.id = v.tool_id
      ORDER BY
        CASE
          WHEN v.next_calibration_date IS NULL THEN 0
          WHEN v.next_calibration_date <= date('now', '+30 days') THEN 0
          WHEN v.next_calibration_date <= date('now', '+180 days') THEN 1
          ELSE 2
        END,
        CASE WHEN v.next_calibration_date IS NULL THEN '9999-12-31' ELSE v.next_calibration_date END ASC,
        v.tool_name ASC
    `);
  }, [ready, version]);

  const filtered = useMemo(() => rows.filter((row) => {
    const status = getCalibrationRowStatus(row);
    if (searchName && !row.tool_name.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (searchBrand && !(row.brand || "").toLowerCase().includes(searchBrand.toLowerCase())) return false;
    if (typeFilter !== "all" && (row.type || "") !== typeFilter) return false;
    if (searchSerial && !(row.serial_tag || "").toLowerCase().includes(searchSerial.toLowerCase())) return false;
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (frequencyFilter !== "all" && String(row.calibration_frequency || "") !== frequencyFilter) return false;
    if (dateFrom && (!row.next_calibration_date || row.next_calibration_date < dateFrom)) return false;
    if (dateTo && (!row.next_calibration_date || row.next_calibration_date > dateTo)) return false;
    return true;
  }).sort((a, b) => {
    const statusA = getCalibrationRowStatus(a);
    const statusB = getCalibrationRowStatus(b);
    const rankA = STATUS_ORDER[statusA];
    const rankB = STATUS_ORDER[statusB];
    if (rankA !== rankB) return rankA - rankB;
    return (a.next_calibration_date || "9999-12-31").localeCompare(b.next_calibration_date || "9999-12-31");
  }), [rows, searchName, searchBrand, typeFilter, searchSerial, statusFilter, frequencyFilter, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const counts = { total: rows.length, green: 0, yellow: 0, red: 0 };
    rows.forEach((row) => {
      const status = getCalibrationRowStatus(row);
      if (status === "green") counts.green += 1;
      else if (status === "yellow") counts.yellow += 1;
      else counts.red += 1;
    });
    return counts;
  }, [rows]);

  const activeRow = filtered.find((row) => row.tool_id === viewToolId || row.tool_id === editToolId) || rows.find((row) => row.tool_id === viewToolId || row.tool_id === editToolId) || null;

  const clearFilters = () => {
    setSearchName("");
    setSearchBrand("");
    setTypeFilter("all");
    setSearchSerial("");
    setStatusFilter("all");
    setFrequencyFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const downloadCertificate = (row: CalibrationRow) => {
    if (!row.certificate_file || !row.certificate_filename) return;
    const link = document.createElement("a");
    link.href = row.certificate_file;
    link.download = row.certificate_filename;
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <BiLabel en="Calibration" pt="Calibração" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground"><BiLabel en="Total" pt="Total" size="small" /></div><div className="text-2xl font-bold">{metrics.total}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground"><BiLabel en="Calibrated" pt="Em Dia" size="small" /></div><div className="text-2xl font-bold">{metrics.green}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground"><BiLabel en="Expiring Soon" pt="Vencimento Próximo" size="small" /></div><div className="text-2xl font-bold">{metrics.yellow}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground"><BiLabel en="Expired" pt="Vencidos" size="small" /></div><div className="text-2xl font-bold">{metrics.red}</div></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {metrics.red > 0 && (
          <Card className={`p-4 ${CALIBRATION_STATUS_CLASSES.red.card}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-cal-red" />
              <div>
                <div className="font-semibold">{lang === "pt" ? `${metrics.red} ferramenta(s) com calibração vencida ou crítica` : `${metrics.red} tool(s) with expired or critical calibration`}</div>
                <div className="text-sm text-muted-foreground">{lang === "pt" ? "Essas ferramentas ficam bloqueadas na cautela." : "These tools are blocked from check-out."}</div>
              </div>
            </div>
          </Card>
        )}
        {metrics.yellow > 0 && (
          <Card className={`p-4 ${CALIBRATION_STATUS_CLASSES.yellow.card}`}>
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 text-cal-yellow" />
              <div>
                <div className="font-semibold">{lang === "pt" ? `${metrics.yellow} ferramenta(s) com calibração vencendo em até 180 dias` : `${metrics.yellow} tool(s) with calibration expiring within 180 days`}</div>
                <div className="text-sm text-muted-foreground">{lang === "pt" ? "Agende a calibração com antecedência." : "Schedule calibration ahead of time."}</div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={lang === "pt" ? "Nome da ferramenta" : "Tool name"} value={searchName} onChange={(e) => setSearchName(e.target.value)} />
        </div>
        <Input placeholder={lang === "pt" ? "Marca" : "Brand"} value={searchBrand} onChange={(e) => setSearchBrand(e.target.value)} />
        <Input placeholder={lang === "pt" ? "Nº Série / TAG" : "Serial No / TAG"} value={searchSerial} onChange={(e) => setSearchSerial(e.target.value)} />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="Type / Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All / Todos</SelectItem>
            {CALIBRATION_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All / Todos</SelectItem>
            <SelectItem value="green">Calibrated / Em Dia</SelectItem>
            <SelectItem value="yellow">Expiring Soon / Próximo</SelectItem>
            <SelectItem value="red">Expired / Vencido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger><SelectValue placeholder="Frequency / Frequência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All / Todos</SelectItem>
            <SelectItem value="6">6 months / 6 meses</SelectItem>
            <SelectItem value="12">12 months / 12 meses</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <div className="xl:col-span-4">
          <Button variant="outline" onClick={clearFilters}>
            <BiLabel en="Clear Filters" pt="Limpar Filtros" size="small" />
          </Button>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground" />
            <BiLabel en="No tools require calibration" pt="Nenhuma ferramenta requer calibração" className="items-center" />
            <p className="text-sm text-muted-foreground">{lang === "pt" ? "Marque ferramentas como requerendo calibração no Inventário." : "Mark tools as requiring calibration in Inventory."}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><BiLabel en="Status" pt="Status" size="table" /></TableHead>
                <TableHead><BiLabel en="Tool Name" pt="Nome da Ferramenta" size="table" /></TableHead>
                <TableHead><BiLabel en="Brand" pt="Marca" size="table" /></TableHead>
                <TableHead><BiLabel en="Type" pt="Tipo" size="table" /></TableHead>
                <TableHead><BiLabel en="Serial No / TAG" pt="Nº Série / TAG" size="table" /></TableHead>
                <TableHead><BiLabel en="Last Calibration" pt="Última Calibração" size="table" /></TableHead>
                <TableHead><BiLabel en="Frequency" pt="Frequência" size="table" /></TableHead>
                <TableHead><BiLabel en="Next Due Date" pt="Próximo Vencimento" size="table" /></TableHead>
                <TableHead><BiLabel en="Certifying Company" pt="Empresa Certificadora" size="table" /></TableHead>
                <TableHead><BiLabel en="Calibration Cost" pt="Valor da Calibração" size="table" /></TableHead>
                <TableHead><BiLabel en="Certificate" pt="Certificado" size="table" /></TableHead>
                <TableHead className="text-right"><BiLabel en="Actions" pt="Ações" size="table" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const status = getCalibrationRowStatus(row);
                const styles = CALIBRATION_STATUS_CLASSES[status];
                const daysRemaining = getDaysRemaining(row.next_calibration_date);
                return (
                  <TableRow key={row.tool_id} className={`border-l-4 ${styles.border}`}>
                    <TableCell>
                      <Badge variant="outline" className={styles.badge}>{getCalibrationBadgeLabel(status, lang)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.tool_name}</div>
                      <div className="text-xs text-muted-foreground">{buildDaysRemainingLabel(daysRemaining, lang)}</div>
                    </TableCell>
                    <TableCell>{row.brand || "—"}</TableCell>
                    <TableCell>{row.type || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.serial_tag || "—"}</TableCell>
                    <TableCell>{formatDateDisplay(row.last_calibration_date)}</TableCell>
                    <TableCell>{getFrequencyLabel(row.calibration_frequency, lang)}</TableCell>
                    <TableCell><span className={`inline-flex rounded px-2 py-1 ${styles.tint}`}>{formatDateDisplay(row.next_calibration_date)}</span></TableCell>
                    <TableCell>{row.certifying_company || "—"}</TableCell>
                    <TableCell>{row.calibration_cost_eur != null ? formatEUR(row.calibration_cost_eur) : "—"}</TableCell>
                    <TableCell>
                      {row.certificate_file ? (
                        <Button variant="ghost" size="icon" onClick={() => downloadCertificate(row)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewToolId(row.tool_id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditToolId(row.tool_id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <CalibrationViewDialog
        open={!!viewToolId}
        row={activeRow && viewToolId ? activeRow : null}
        onOpenChange={(open) => !open && setViewToolId(null)}
        onEdit={() => {
          if (viewToolId) setEditToolId(viewToolId);
          setViewToolId(null);
        }}
      />
      <CalibrationEditDialog
        open={!!editToolId}
        row={activeRow && editToolId ? activeRow : null}
        onOpenChange={(open) => !open && setEditToolId(null)}
      />
    </div>
  );
};

export default Calibration;
