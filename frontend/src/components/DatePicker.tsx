import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { parseDateInput, parseSlotInput } from "../lib/format";

/**
 * Real calendar popups for yyyy/mm/dd entry. Native date/datetime-local
 * inputs render mm/dd/yyyy in US-locale browsers and ignore our format, so
 * every date in the app goes through these text + calendar fields instead.
 */

const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const pad = (n: number): string => String(n).padStart(2, "0");

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toSlotText(d: Date): string {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateText(d: Date): string {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

function Calendar({ value, onPick, disablePast }: {
  value: Date | null;
  onPick: (d: Date) => void;
  disablePast?: boolean;
}) {
  const init = value ?? new Date();
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());
  const today = startOfDay(new Date()).getTime();
  const sel = value ? startOfDay(value).getTime() : null;
  const firstDow = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();

  function shift(dir: number) {
    const d = new Date(y, m + dir, 1);
    setY(d.getFullYear());
    setM(d.getMonth());
  }

  function goToday() {
    const d = new Date();
    setY(d.getFullYear());
    setM(d.getMonth());
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month"
          className="rounded-md p-1.5 transition hover:bg-surface-container">
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <p className="text-sm font-extrabold">{MONTHS[m]} {y}</p>
        <button type="button" onClick={() => shift(1)} aria-label="Next month"
          className="rounded-md p-1.5 transition hover:bg-surface-container">
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-0.5" role="grid" aria-label={`${MONTHS[m]} ${y}`}>
        {WEEK.map((w) => (
          <span key={w} className="grid size-8 place-items-center text-[11px] font-extrabold text-on-surface-variant">{w}</span>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: total }).map((_, i) => {
          const day = new Date(y, m, i + 1);
          const t = day.getTime();
          const disabled = disablePast === true && t < today;
          const selected = sel === t;
          const isToday = today === t;
          return (
            <button
              key={i + 1}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={`${y}/${pad(m + 1)}/${pad(i + 1)}`}
              disabled={disabled}
              onClick={() => onPick(day)}
              className={`grid size-8 place-items-center rounded-md text-[13px] transition ${
                selected
                  ? "bg-pine-950 font-bold text-white"
                  : disabled
                    ? "cursor-not-allowed text-on-surface-variant opacity-30"
                    : isToday
                      ? "font-bold text-primary hover:bg-primary-container"
                      : "hover:bg-primary-container"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={goToday}
        className="mt-1.5 text-xs font-bold text-primary hover:underline">
        Today
      </button>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-outline bg-white px-3.5 py-2.5 font-mono text-sm outline-none transition focus:border-primary";
const iconButtonClass =
  "grid shrink-0 place-items-center rounded-md border border-outline bg-white px-2.5 transition hover:border-pine-800";
const miniSelectClass =
  "rounded-md border border-outline bg-white px-2 py-1.5 font-mono text-sm outline-none transition focus:border-primary";

/** Date + time as yyyy/mm/dd HH:MM — typed or picked from the calendar. */
export function DateTimeField({ id, value, onChange, placeholder }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const wrapRef = useDismiss(open, close);
  const t = value.trim();
  const iso = t === "" ? null : parseSlotInput(t);
  const current = iso ? new Date(iso) : null;

  function pickDay(day: Date) {
    const h = current ? current.getHours() : 9;
    const mi = current ? current.getMinutes() : 0;
    onChange(toSlotText(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi)));
  }

  function setTime(h: number, mi: number) {
    const base = current ?? new Date();
    onChange(toSlotText(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, mi)));
  }

  const selH = current ? current.getHours() : 9;
  const selM = pad(current ? current.getMinutes() : 0);
  const minuteOptions = MINUTES.includes(selM) ? MINUTES : [...MINUTES, selM].sort();

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-1.5">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "yyyy/mm/dd HH:MM"}
          inputMode="numeric"
          aria-invalid={t !== "" && !iso}
          className={inputClass}
        />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          aria-label="Pick from calendar" title="Pick from calendar"
          className={iconButtonClass}>
          <CalendarDays size={17} aria-hidden="true" />
        </button>
      </div>
      {t !== "" && !iso && (
        <p role="alert" className="mt-1 font-mono text-xs font-medium text-error">Use yyyy/mm/dd HH:MM</p>
      )}
      {open && (
        <div className="elev-2 absolute z-50 mt-1.5 w-64 rounded-lg border border-outline bg-white p-3">
          <Calendar value={current} onPick={pickDay} disablePast />
          <div className="mt-2 flex items-center gap-1.5 border-t border-outline/60 pt-2.5">
            <span className="text-xs font-bold text-on-surface-variant">Time</span>
            <select value={pad(selH)} aria-label="Hour"
              onChange={(e) => setTime(Number(e.target.value), Number(selM))}
              className={miniSelectClass}>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={pad(h)}>{pad(h)}</option>
              ))}
            </select>
            <span aria-hidden="true" className="font-mono text-sm font-bold">:</span>
            <select value={selM} aria-label="Minute"
              onChange={(e) => setTime(selH, Number(e.target.value))}
              className={miniSelectClass}>
              {minuteOptions.map((mi) => (
                <option key={mi} value={mi}>{mi}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

/** Calendar date as yyyy/mm/dd — typed or picked from the calendar. */
export function DateField({ id, value, onChange, placeholder, disablePast }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; disablePast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const wrapRef = useDismiss(open, close);
  const t = value.trim();
  const ok = t === "" || parseDateInput(t) !== null;
  const current = parseDateInput(t) ? new Date(`${t.replaceAll("/", "-")}T12:00:00`) : null;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-1.5">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "yyyy/mm/dd"}
          inputMode="numeric"
          aria-invalid={!ok}
          className={inputClass}
        />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          aria-label="Pick from calendar" title="Pick from calendar"
          className={iconButtonClass}>
          <CalendarDays size={17} aria-hidden="true" />
        </button>
      </div>
      {!ok && (
        <p role="alert" className="mt-1 font-mono text-xs font-medium text-error">Use yyyy/mm/dd</p>
      )}
      {open && (
        <div className="elev-2 absolute z-50 mt-1.5 w-64 rounded-lg border border-outline bg-white p-3">
          <Calendar
            value={current}
            onPick={(d) => { onChange(toDateText(d)); close(); }}
            disablePast={disablePast}
          />
        </div>
      )}
    </div>
  );
}
