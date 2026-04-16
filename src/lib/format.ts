const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function formatEUR(value: number | null | undefined): string {
  if (value == null || isNaN(value as number)) return "€ 0,00";
  return eurFormatter.format(value).replace("€", "€ ").replace("  ", " ");
}

export function parseEUR(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[€\s.]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
