import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Star } from "lucide-react";
import { cn, formatNPR, initials } from "../lib/format";
import { STATUS_LABELS } from "../lib/booking";
import type { BookingStatus, VerificationState } from "../lib/types";

type Variant = "primary" | "dark" | "marigold" | "secondary" | "outline" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-white shadow-[0_6px_18px_rgb(15_107_68/0.35)] hover:bg-pine-800 hover:shadow-[0_8px_22px_rgb(15_107_68/0.4)] active:scale-[0.98]",
  dark: "bg-pine-950 text-white hover:bg-pine-900 active:scale-[0.98]",
  marigold:
    "bg-marigold-300 text-pine-950 shadow-[0_6px_18px_rgb(233_163_25/0.4)] hover:brightness-105 active:scale-[0.98]",
  secondary: "bg-primary-container text-on-primary-container hover:brightness-95 active:scale-[0.98]",
  outline:
    "border border-outline bg-white/80 text-on-surface hover:border-primary hover:text-primary active:scale-[0.98]",
  danger: "bg-error text-white hover:brightness-110 active:scale-[0.98]",
  ghost: "text-primary hover:bg-primary-container active:scale-[0.98]",
};

export function Button({ variant = "primary", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "elev-1 rounded-lg border border-outline/80 bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-sm font-medium text-error">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-on-surface-variant">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_CLS =
  "w-full rounded-lg border border-outline bg-white px-3.5 py-2.5 text-sm text-on-surface shadow-[inset_0_1px_2px_rgb(23_33_27/0.05)] placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(INPUT_CLS, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 4} className={cn(INPUT_CLS, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(INPUT_CLS, props.className)} />;
}

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "marigold";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-container text-on-surface",
  success: "bg-success-container text-on-primary-container",
  warning: "bg-warning-container text-warning",
  error: "bg-error-container text-error",
  info: "bg-info-container text-info",
  marigold: "bg-marigold-300 text-pine-950",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<BookingStatus, Tone> = {
  pending: "warning",
  "awaiting-worker": "warning",
  confirmed: "info",
  "en-route": "info",
  "in-progress": "info",
  "awaiting-confirmation": "warning",
  completed: "success",
  cancelled: "neutral",
  disputed: "error",
};

const STATUS_DOT: Record<BookingStatus, string> = {
  pending: "bg-warning",
  "awaiting-worker": "bg-warning",
  confirmed: "bg-info",
  "en-route": "bg-info",
  "in-progress": "bg-info",
  "awaiting-confirmation": "bg-warning",
  completed: "bg-success",
  cancelled: "bg-on-surface-variant",
  disputed: "bg-error",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const VERIFY_LABELS: Record<VerificationState, string> = {
  draft: "Draft",
  "awaiting-documents": "Awaiting documents",
  "under-review": "Under review",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

const VERIFY_TONE: Record<VerificationState, Tone> = {
  draft: "neutral",
  "awaiting-documents": "warning",
  "under-review": "info",
  verified: "success",
  rejected: "error",
  suspended: "error",
};

export function VerifyBadge({ state }: { state: VerificationState }) {
  return <Badge tone={VERIFY_TONE[state]}>{VERIFY_LABELS[state]}</Badge>;
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${value} out of 5`}>
      <Star size={15} className="fill-marigold-500 text-marigold-500" aria-hidden="true" />
      <strong>{value.toFixed(1)}</strong>
      {count !== undefined && <span className="text-on-surface-variant">({count.toLocaleString()})</span>}
    </span>
  );
}

export function Price({ paisa, prefix = "" }: { paisa: number; prefix?: string }) {
  if (paisa <= 0) return <span className="font-display text-lg font-semibold">Custom quote</span>;
  return (
    <span className="font-display text-lg font-semibold tracking-tight">
      {prefix}
      {formatNPR(paisa)}
    </span>
  );
}

export function Avatar({
  name,
  hue,
  size = 44,
  ring = false,
}: {
  name: string;
  hue: number;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        ring && "ring-2 ring-marigold-300 ring-offset-2 ring-offset-white",
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, hsl(${hue} 50% 42%), hsl(${(hue + 30) % 360} 45% 30%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Tinted icon tile with per-category hue. */
export function ArtTile({
  hue,
  size = 44,
  children,
}: {
  hue: number;
  size?: number;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-md"
      style={{
        width: size,
        height: size,
        color: `hsl(${hue} 55% 28%)`,
        background: `linear-gradient(135deg, hsl(${hue} 70% 90%), hsl(${hue} 65% 80%))`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 45% 70%)`,
      }}
    >
      {children}
    </span>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="flex flex-wrap gap-1 overflow-x-auto border-b-2 border-outline/70"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "cursor-pointer px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition",
            value === t.id
              ? "border-b-[3px] border-primary text-primary"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-pine-950/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="elev-2 w-full max-w-lg rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="cursor-pointer rounded-full px-2.5 py-1 text-xl leading-none hover:bg-surface-container"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-outline bg-surface-container/50 px-6 py-12 text-center">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  body,
  align = "left",
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p
        className={cn(
          "flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] uppercase",
          align === "center" && "justify-center",
          dark ? "text-marigold-300" : "text-primary",
        )}
      >
        <span aria-hidden="true" className={cn("h-px w-7", dark ? "bg-marigold-300" : "bg-primary")} />
        {eyebrow}
      </p>
      <h2
        className={cn(
          "font-display mt-2 text-3xl font-semibold text-balance md:text-4xl",
          dark ? "text-white" : "text-on-surface",
        )}
      >
        {title}
      </h2>
      {body && (
        <p className={cn("mt-3 leading-relaxed", dark ? "text-white/75" : "text-on-surface-variant")}>
          {body}
        </p>
      )}
    </div>
  );
}

/** Consistent inner-page hero band. */
export function PageHero({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="ring-band dotgrid-light border-b border-pine-900">
      <div className="wrap py-12 md:py-16">
        <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-marigold-300 uppercase">
          <span aria-hidden="true" className="h-px w-7 bg-marigold-300" />
          {eyebrow}
        </p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-semibold text-balance text-white md:text-5xl">
          {title}
        </h1>
        {body && <p className="mt-3 max-w-2xl leading-relaxed text-white/75">{body}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
