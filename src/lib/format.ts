const eurFormatter = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurFormatterPrecise = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatEur(
  amount: number | null | undefined,
  precise = false,
): string {
  if (amount === null || amount === undefined) return "—";
  return precise
    ? eurFormatterPrecise.format(amount)
    : eurFormatter.format(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return dateFormatter.format(new Date(date));
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

export const DISTRICT_LABELS: Record<number, string> = {
  1: "1. Innere Stadt",
  2: "2. Leopoldstadt",
  3: "3. Landstraße",
  4: "4. Wieden",
  5: "5. Margareten",
  6: "6. Mariahilf",
  7: "7. Neubau",
  8: "8. Josefstadt",
  9: "9. Alsergrund",
  10: "10. Favoriten",
  11: "11. Simmering",
  12: "12. Meidling",
  13: "13. Hietzing",
  14: "14. Penzing",
  15: "15. Rudolfsheim-Fünfhaus",
  16: "16. Ottakring",
  17: "17. Hernals",
  18: "18. Währing",
  19: "19. Döbling",
  20: "20. Brigittenau",
  21: "21. Floridsdorf",
  22: "22. Donaustadt",
  23: "23. Liesing",
};

export function districtLabel(district: number | null): string {
  if (district === null) return "Unknown district";
  return DISTRICT_LABELS[district] ?? `${district}. district`;
}

export function enumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
