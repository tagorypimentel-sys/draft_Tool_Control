import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, Download, Upload } from "lucide-react";
import { format, isAfter, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BiLabel } from "@/components/BiLabel";
import { useDb } from "@/hooks/useDb";
import { all, exec } from "@/lib/db";
import { formatEUR, parseEUR } from "@/lib/format";
import {
  buildDaysRemainingLabel,
  calcNextDueDate,
  CALIBRATION_STATUS_CLASSES,
  CalibrationRow,
  formatDateDisplay,
  getCalibrationBadgeLabel,
  getCalibrationStatus,
  getDaysRemaining,
  getFrequencyLabel,
} from "@/lib/calibration";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  row: CalibrationRow | null;
  onOpenChange: (open: boolean) => void;
}

export function CalibrationEditDialog({ open, row, onOpenChange }: Props) {
  const { bump } = useDb();
  const { lang } = useLanguage();
  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const [lastCalibrationDate, setLastCalibrationDate] = useState<Date | undefined>();
  const [frequency, setFrequency] = useState<"6" | "12">("6");
  const [certifyingCompany, setCertifyingCompany] = useState("");
  const [calibrationCost, setCalibrationCost] = useState("");
  const [certificateData, setCertificateData] = useState<string | null>(null);
  const [certificateFilename, setCertificateFilename] = useState<string | null>(null);
  const [certificateUploadedAt, setCertificateUploadedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setLastCalibrationDate(row.last_calibration_date ? parseISO(row.last_calibration_date) : undefined);
    setFrequency(row.calibration_frequency === 12 ? "12" : "6");
    setCertifyingCompany(row.certifying_company || "");
    setCalibrationCost(row.calibration_cost_eur != null ? String(row.calibration_cost_eur).replace(".", ",") : "");
    setCertificateData(row.certificate_file || null);
    setCertificateFilename(row.certificate_filename || null);
    setCertificateUploadedAt(row.certificate_uploaded_at || null);
  }, [open, row]);

  const labOptions = useMemo(() => all<{ name: string }>("SELECT name FROM calibration_labs ORDER BY name"), [open]);

  const nextDueDate = useMemo(() => {
    if (!lastCalibrationDate) return null;
    return calcNextDueDate(format(lastCalibrationDate, "yyyy-MM-dd"), frequency === "12" ? 12 : 6);
  }, [lastCalibrationDate, frequency]);

  const status = getCalibrationStatus(nextDueDate);
  const styles = CALIBRATION_STATUS_CLASSES[status];
  const daysRemaining = getDaysRemaining(nextDueDate);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    const accepted = ["application/pdf", "image/jpeg", "image/png"];
    if (!accepted.includes(file.type)) {
      toast.error("Invalid file type / Tipo de arquivo inválido");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB / Máx. 10 MB");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setCertificateData(dataUrl);
    setCertificateFilename(file.name);
    setCertificateUploadedAt(new Date().toISOString());
  };

  const downloadCertificate = () => {
    if (!certificateData || !certificateFilename) return;
    const link = document.createElement("a");
    link.href = certificateData;
    link.download = certificateFilename;
    link.click();
  };

  const save = () => {
    if (!row) return;
    if (!lastCalibrationDate) return toast.error("Last calibration required / Última calibração obrigatória");
    if (isAfter(lastCalibrationDate, today)) return toast.error("Date cannot be in the future / Data não pode ser futura");
    if (!certifyingCompany.trim()) return toast.error("Certifying company required / Empresa certificadora obrigatória");
    if (!nextDueDate) return toast.error("Invalid next due date / Próximo vencimento inválido");

    const lastDateIso = format(lastCalibrationDate, "yyyy-MM-dd");
    const costValue = calibrationCost.trim() ? parseEUR(calibrationCost) : null;
    const uploadedAt = certificateUploadedAt || (certificateData ? new Date().toISOString() : null);

    exec([
      {
        sql: `INSERT INTO calibration_records (
          tool_id, current_date_snapshot, last_calibration_date, frequency_months, next_calibration_date,
          certifying_company, calibration_cost_eur, certificate_file, certificate_filename, certificate_uploaded_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        params: [
          row.tool_id,
          todayIso,
          lastDateIso,
          Number(frequency),
          nextDueDate,
          certifyingCompany.trim(),
          costValue,
          certificateData,
          certificateFilename,
          uploadedAt,
        ],
      },
      {
        sql: `UPDATE tools SET last_calibration_date=?, next_calibration_date=?, calibration_frequency=? WHERE id=?`,
        params: [lastDateIso, nextDueDate, Number(frequency), row.tool_id],
      },
      {
        sql: `INSERT OR IGNORE INTO calibration_labs (name) VALUES (?)`,
        params: [certifyingCompany.trim()],
      },
    ]);

    bump();
    toast.success("Calibration saved / Calibração salva");
    onOpenChange(false);
  };

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <BiLabel en="Edit Calibration" pt="Editar Calibração" />
          </DialogTitle>
          <DialogDescription>
            {row.tool_name} · {row.serial_tag || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label><BiLabel en="Current Date" pt="Data Atual" size="small" /></Label>
              <Input value={format(today, "dd/MM/yyyy")} readOnly />
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Last Calibration Date" pt="Data da Última Calibração" size="small" /></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !lastCalibrationDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {lastCalibrationDate ? format(lastCalibrationDate, "dd/MM/yyyy") : <span>DD/MM/YYYY</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={lastCalibrationDate}
                    onSelect={setLastCalibrationDate}
                    disabled={(date) => date > today}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1">
            <Label><BiLabel en="Frequency" pt="Frequência" size="small" /></Label>
            <ToggleGroup type="single" value={frequency} onValueChange={(value) => value && setFrequency(value as "6" | "12")}>
              <ToggleGroupItem value="6" variant="outline">
                <BiLabel en="6 months" pt="6 meses" size="small" />
              </ToggleGroupItem>
              <ToggleGroupItem value="12" variant="outline">
                <BiLabel en="12 months" pt="12 meses" size="small" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-2">
            <Label><BiLabel en="Next Calibration Date" pt="Data da Próxima Calibração" size="small" /></Label>
            <div className={`flex flex-wrap items-center gap-2 rounded-md border p-3 ${styles.card}`}>
              <span className="font-medium">{formatDateDisplay(nextDueDate)}</span>
              <Badge variant="outline" className={styles.badge}>{getCalibrationBadgeLabel(status, lang)}</Badge>
            </div>
            <div className={`rounded-md border p-3 text-sm ${styles.card}`}>
              <div>{lang === "pt" ? "Última calibração" : "Last calibration"}: {lastCalibrationDate ? format(lastCalibrationDate, "dd/MM/yyyy") : "—"}</div>
              <div>{lang === "pt" ? "Frequência" : "Frequency"}: {getFrequencyLabel(Number(frequency), lang)}</div>
              <div>{lang === "pt" ? "Próximo vencimento" : "Next due"}: {formatDateDisplay(nextDueDate)}</div>
              <div>{lang === "pt" ? "Dias restantes" : "Days remaining"}: {buildDaysRemainingLabel(daysRemaining, lang)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label><BiLabel en="Calibration Certificate" pt="Certificado de Calibração" size="small" /></Label>
            <div className="flex flex-wrap gap-2 items-center">
              <Button type="button" variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <BiLabel en="Upload Certificate" pt="Enviar Certificado" size="small" />
                  <input className="hidden" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
                </label>
              </Button>
              {certificateData && certificateFilename && (
                <Button type="button" variant="outline" onClick={downloadCertificate}>
                  <Download className="h-4 w-4" />
                  <BiLabel en="Download" pt="Baixar" size="small" />
                </Button>
              )}
            </div>
            {certificateFilename ? (
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">{certificateFilename}</div>
                <div className="text-muted-foreground">{certificateUploadedAt ? format(parseISO(certificateUploadedAt), "dd/MM/yyyy HH:mm") : ""}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No file / Sem arquivo</div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label><BiLabel en="Certifying Company" pt="Nome da Empresa Certificadora" size="small" /></Label>
              <Input list="calibration-labs" value={certifyingCompany} onChange={(e) => setCertifyingCompany(e.target.value)} />
              <datalist id="calibration-labs">
                {labOptions.map((lab) => <option key={lab.name} value={lab.name} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label><BiLabel en="Calibration Cost" pt="Valor Pago pela Calibração" size="small" /></Label>
              <Input value={calibrationCost} onChange={(e) => setCalibrationCost(e.target.value)} placeholder="0,00" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <BiLabel en="Cancel" pt="Cancelar" size="small" />
          </Button>
          <Button onClick={save}>
            <BiLabel en="Save" pt="Salvar" size="small" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
