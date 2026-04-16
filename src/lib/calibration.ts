import { addMonths, differenceInDays, format, parseISO, startOfDay } from "date-fns";

export type CalibrationStatus = "green" | "yellow" | "red" | "never";

export type CalibrationRow = {
  tool_id: string;
  tool_name: string;
  brand: string | null;
  type: string | null;
  serial_tag: string | null;
  next_calibration_date: string | null;
  last_calibration_date: string | null;
  calibration_frequency: number | null;
  certifying_company: string | null;
  calibration_cost_eur: number | null;
  certificate_file: string | null;
  certificate_filename: string | null;
  certificate_uploaded_at: string | null;
  calibration_status: string;
  days_remaining: number | null;
};

export const CALIBRATION_TYPE_OPTIONS = [
  "Rope Access", "PPE", "Load/Lift", "Electrical", "Abrasive", "Welding",
  "General", "Painting", "Polish", "Cleaning", "Corded", "Cordless",
  "Pneumatics", "Measurement", "Hand",
] as const;

export function getCalibrationStatus(nextDueDate: string | null): CalibrationStatus {
  if (!nextDueDate) return "never";

  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(nextDueDate));
  const daysLeft = differenceInDays(due, today);

  if (daysLeft > 180) return "green";
  if (daysLeft > 30) return "yellow";
  return "red";
}

export function calcNextDueDate(lastCalibrationDate: string, frequencyMonths: 6 | 12): string {
  const base = parseISO(lastCalibrationDate);
  return format(addMonths(base, frequencyMonths), "yyyy-MM-dd");
}

export function getDaysRemaining(nextDueDate: string | null): number | null {
  if (!nextDueDate) return null;
  return differenceInDays(startOfDay(parseISO(nextDueDate)), startOfDay(new Date()));
}

export function formatDateDisplay(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "dd/MM/yyyy");
}

export function getFrequencyLabel(value: number | null | undefined, lang: "en" | "pt") {
  if (value === 6) return lang === "pt" ? "6 meses" : "6 months";
  if (value === 12) return lang === "pt" ? "12 meses" : "12 months";
  return "—";
}

export function getCalibrationBadgeLabel(status: CalibrationStatus, lang: "en" | "pt") {
  const labels = {
    en: {
      green: "Calibrated",
      yellow: "Expiring Soon",
      red: "Expired / Critical",
      never: "Never Calibrated",
    },
    pt: {
      green: "Calibrado em Dia",
      yellow: "Vencimento Próximo",
      red: "Vencido / Crítico",
      never: "Nunca Calibrado",
    },
  } as const;

  return labels[lang][status];
}

export const CALIBRATION_STATUS_CLASSES: Record<CalibrationStatus, { badge: string; border: string; tint: string; dot: string; card: string }> = {
  green: {
    badge: "border-cal-green/20 bg-cal-green-bg text-cal-green-fg",
    border: "border-l-cal-green",
    tint: "bg-cal-green-bg/60",
    dot: "bg-cal-green",
    card: "border-cal-green/30 bg-cal-green-bg/40",
  },
  yellow: {
    badge: "border-cal-yellow/20 bg-cal-yellow-bg text-cal-yellow-fg",
    border: "border-l-cal-yellow",
    tint: "bg-cal-yellow-bg/60",
    dot: "bg-cal-yellow",
    card: "border-cal-yellow/30 bg-cal-yellow-bg/40",
  },
  red: {
    badge: "border-cal-red/20 bg-cal-red-bg text-cal-red-fg",
    border: "border-l-cal-red",
    tint: "bg-cal-red-bg/60",
    dot: "bg-cal-red",
    card: "border-cal-red/30 bg-cal-red-bg/40",
  },
  never: {
    badge: "border-cal-red/20 bg-cal-red-bg text-cal-red-fg",
    border: "border-l-cal-red",
    tint: "bg-cal-red-bg/60",
    dot: "bg-cal-red",
    card: "border-cal-red/30 bg-cal-red-bg/40",
  },
};

export function getCalibrationRowStatus(row: Pick<CalibrationRow, "next_calibration_date">): CalibrationStatus {
  return getCalibrationStatus(row.next_calibration_date);
}

export function buildDaysRemainingLabel(daysRemaining: number | null, lang: "en" | "pt") {
  if (daysRemaining == null) return lang === "pt" ? "Sem histórico de calibração" : "No calibration history";
  if (daysRemaining > 0) return lang === "pt" ? `${daysRemaining} dias para o vencimento` : `${daysRemaining} days until expiry`;
  if (daysRemaining === 0) return lang === "pt" ? "Vence hoje" : "Expires today";
  return lang === "pt" ? `Vencido há ${Math.abs(daysRemaining)} dias` : `Expired ${Math.abs(daysRemaining)} days ago`;
}
