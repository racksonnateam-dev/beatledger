export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function formatTimestamp(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "Not available";
  if (seconds < 0.35) return "Start of the beat";
  return formatDuration(seconds);
}

export function formatPercent(confidence: number | null | undefined) {
  if (confidence == null || !Number.isFinite(confidence)) return "—";
  return `${(confidence * 100).toFixed(1)}%`;
}
