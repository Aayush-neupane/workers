export function formatNPR(paisa: number): string {
  return `Rs ${(paisa / 100).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Calendar date as yyyy/mm/dd (e.g. 2030/06/01). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

/** Date + time as yyyy/mm/dd HH:MM (24h, e.g. 2030/06/01 10:00). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Booking slot as yyyy/mm/dd (Weekday) HH:MM (e.g. 2030/06/01 (Sat) 10:00). */
export function formatSlot(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(iso)} (${WEEKDAYS[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Day-group header as yyyy/mm/dd (Weekday). */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(iso)} (${WEEKDAYS[d.getDay()]})`;
}

/** Live preview for a datetime-local input value (yyyy/mm/dd HH:MM). */
export function previewDateTimeLocal(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `→ ${formatDateTime(d.toISOString())}`;
}
