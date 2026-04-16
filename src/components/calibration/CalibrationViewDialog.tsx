import { Download, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BiLabel } from "@/components/BiLabel";
import { useLanguage } from "@/hooks/useLanguage";
import { formatEUR } from "@/lib/format";
import {
  buildDaysRemainingLabel,
  CALIBRATION_STATUS_CLASSES,
  CalibrationRow,
  formatDateDisplay,
  getCalibrationBadgeLabel,
  getCalibrationRowStatus,
  getDaysRemaining,
  getFrequencyLabel,
} from "@/lib/calibration";

interface Props {
  open: boolean;
  row: CalibrationRow | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

export function CalibrationViewDialog({ open, row, onOpenChange, onEdit }: Props) {
  const { lang } = useLanguage();
  if (!row) return null;

  const status = getCalibrationRowStatus(row);
  const styles = CALIBRATION_STATUS_CLASSES[status];
  const daysRemaining = getDaysRemaining(row.next_calibration_date);

  const downloadCertificate = () => {
    if (!row.certificate_file || !row.certificate_filename) return;
    const link = document.createElement("a");
    link.href = row.certificate_file;
    link.download = row.certificate_filename;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <BiLabel en="Calibration Details" pt="Detalhes da Calibração" />
          </DialogTitle>
          <DialogDescription>
            {row.tool_name} · {row.serial_tag || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div><b>{lang === "pt" ? "Data Atual" : "Current Date"}:</b> {formatDateDisplay(new Date().toISOString().slice(0, 10))}</div>
          <div>
            <b>Status:</b>{" "}
            <Badge variant="outline" className={styles.badge}>{getCalibrationBadgeLabel(status, lang)}</Badge>
          </div>
          <div><b>{lang === "pt" ? "Última Calibração" : "Last Calibration"}:</b> {formatDateDisplay(row.last_calibration_date)}</div>
          <div><b>{lang === "pt" ? "Frequência" : "Frequency"}:</b> {getFrequencyLabel(row.calibration_frequency, lang)}</div>
          <div>
            <b>{lang === "pt" ? "Próximo Vencimento" : "Next Due Date"}:</b>{" "}
            <span className={`inline-flex rounded px-2 py-1 ${styles.tint}`}>{formatDateDisplay(row.next_calibration_date)}</span>
          </div>
          <div><b>{lang === "pt" ? "Empresa Cert." : "Certifying Company"}:</b> {row.certifying_company || "—"}</div>
          <div><b>{lang === "pt" ? "Valor Pago" : "Calibration Cost"}:</b> {row.calibration_cost_eur != null ? formatEUR(row.calibration_cost_eur) : "—"}</div>
          <div><b>{lang === "pt" ? "Dias restantes" : "Days remaining"}:</b> {buildDaysRemainingLabel(daysRemaining, lang)}</div>
          <div>
            <b>{lang === "pt" ? "Certificado" : "Certificate"}:</b>{" "}
            {row.certificate_file ? (
              <Button variant="outline" size="sm" className="h-8" onClick={downloadCertificate}>
                <Download className="h-4 w-4" />
                <BiLabel en="Download Certificate" pt="Baixar Certificado" size="small" inline />
              </Button>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <BiLabel en="Close" pt="Fechar" size="small" />
          </Button>
          <Button onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            <BiLabel en="Edit" pt="Editar" size="small" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
