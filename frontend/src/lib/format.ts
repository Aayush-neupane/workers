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

/**
 * Parse a yyyy/mm/dd HH:MM value (24h local time) to an ISO string.
 * Returns null unless the shape is exact and the calendar date is real.
 */
export function parseSlotInput(value: string): string | null {
  const m = value.trim().match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (mo < 1 || mo > 12 || day < 1 || day > 31 || h > 23 || mi > 59) return null;
  const d = new Date(y, mo - 1, day, h, mi);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d.toISOString();
}

/**
 * Parse a yyyy/mm/dd value to a yyyy-mm-dd API date. Null unless exact/real.
 */
export function parseDateInput(value: string): string | null {
  const m = value.trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
