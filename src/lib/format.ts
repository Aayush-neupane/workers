/** Join class names, skipping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Format integer paisa as NPR display string, e.g. 200000 -> "Rs 2,000". */
export function formatNPR(paisa: number): string {
  const rupees = Math.floor(paisa / 100);
  return `Rs ${rupees.toLocaleString("en-IN")}`;
}

/** Short date-time in Asia/Kathmandu, e.g. "12 Oct, 10:30 AM". */
export function formatSlot(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Short date in Asia/Kathmandu, e.g. "12 Oct 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
