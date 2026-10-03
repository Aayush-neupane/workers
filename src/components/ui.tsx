import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Star } from "lucide-react";
import { cn, formatNPR, initials } from "../lib/format";
import { STATUS_LABELS } from "../lib/booking";
import type { BookingStatus, VerificationState } from "../lib/types";

type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:brightness-110",
  secondary: "bg-primary-container text-on-primary-container hover:brightness-95",
  outline: "border border-outline bg-surface text-on-surface hover:bg-surface-container",
  danger: "bg-error text-white hover:brightness-110",
  ghost: "text-primary hover:bg-primary-container",
};

export function Button({ variant = "primary", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
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
    <div className={cn("elev-1 rounded-lg border border-outline bg-white", className)}>{children}</div>
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
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-sm text-error">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-on-surface-variant">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_CLS =
  "w-full rounded-md border border-outline bg-white px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary";

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(INPUT_CLS, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 4} className={cn(INPUT_CLS, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(INPUT_CLS, props.className)} />;
}

type Tone = "neutral" | "success" | "warning" | "error" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-container text-on-surface",
  success: "bg-success-container text-on-primary-container",
  warning: "bg-warning-container text-warning",
  error: "bg-error-container text-error",
  info: "bg-info-container text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
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

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
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
      <Star size={15} className="fill-secondary text-secondary" aria-hidden="true" />
      <strong>{value.toFixed(1)}</strong>
      {count !== undefined && <span className="text-on-surface-variant">({count})</span>}
    </span>
  );
}

export function Price({ paisa, prefix = "" }: { paisa: number; prefix?: string }) {
  if (paisa <= 0) return <span className="font-semibold">Custom quote</span>;
  return (
    <span className="font-semibold">
      {prefix}
      {formatNPR(paisa)}
    </span>
  );
}

export function Avatar({ name, hue, size = 44 }: { name: string; hue: number; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        backgroundColor: `hsl(${hue} 45% 38%)`,
      }}
    >
      {initials(name)}
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
    <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-1 border-b border-outline">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "cursor-pointer px-4 py-2.5 text-sm font-medium transition",
            value === t.id
              ? "border-b-2 border-primary text-primary"
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
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
          <h2 className="text-lg font-bold">{title}</h2>
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
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-bold tracking-widest text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold text-balance md:text-3xl">{title}</h2>
      {body && <p className="mt-2 text-on-surface-variant">{body}</p>}
    </div>
  );
}
