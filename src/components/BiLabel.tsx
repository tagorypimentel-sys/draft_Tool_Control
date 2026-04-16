import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";

type Size = "default" | "table" | "small";

interface BiLabelProps {
  en: string;
  pt: string;
  size?: Size;
  className?: string;
  inline?: boolean;
}

const sizeMap: Record<Size, string> = {
  default: "text-[15px] font-bold leading-tight",
  table: "text-[13px] font-bold leading-tight",
  small: "text-[12px] font-bold leading-tight",
};

export const BiLabel = ({ en, pt, size = "default", className, inline = false }: BiLabelProps) => {
  const { lang } = useLanguage();
  const text = lang === "pt" ? pt : en;
  return (
    <span
      className={cn(
        sizeMap[size],
        inline ? "inline-flex" : "flex flex-col",
        className,
      )}
    >
      {text}
    </span>
  );
};
