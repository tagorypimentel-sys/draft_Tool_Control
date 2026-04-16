import { cn } from "@/lib/utils";

type Size = "default" | "table" | "small";

interface BiLabelProps {
  en: string;
  pt: string;
  size?: Size;
  className?: string;
  inline?: boolean;
}

const sizeMap: Record<Size, { en: string; pt: string }> = {
  default: { en: "text-[15px] font-bold leading-tight", pt: "text-[11px] italic leading-tight" },
  table: { en: "text-[13px] font-bold leading-tight", pt: "text-[9px] italic leading-tight" },
  small: { en: "text-[12px] font-bold leading-tight", pt: "text-[9px] italic leading-tight" },
};

export const BiLabel = ({ en, pt, size = "default", className, inline = false }: BiLabelProps) => {
  const s = sizeMap[size];
  return (
    <span className={cn("flex flex-col", inline && "inline-flex", className)}>
      <span className={s.en}>{en}</span>
      <span className={cn(s.pt, "text-muted-foreground")}>{pt}</span>
    </span>
  );
};
