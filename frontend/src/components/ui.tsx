import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "outline-light" | "gold" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
  const styles: Record<Variant, string> = {
    primary: "bg-pine-950 text-white hover:bg-pine-800",
    outline: "border border-outline bg-white hover:border-pine-800",
    // For dark surfaces only: transparent background, no bg fight possible.
    "outline-light": "border border-white/40 text-white hover:bg-white/10",
    // Solid marigold action for dark surfaces.
    gold: "bg-marigold-300 text-pine-950 hover:brightness-105",
    ghost: "text-primary hover:bg-primary-container",
    danger: "bg-error text-white hover:brightness-110",
  };
  // NOTE: never pass bg-*, text-* or border-* colors via className — same-property
  // utilities fight the variant in cascade order and text can go invisible.
  // If a new surface needs a button, add a variant here instead.
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}

type LinkButtonVariant = "primary" | "outline" | "ghost";

/** Anchor-styled-as-button classes mirroring Button variants (for <a>/<Link> elements). */
export function linkButtonClass(variant: LinkButtonVariant = "primary"): string {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-bold transition active:scale-[0.98]";
  const styles: Record<LinkButtonVariant, string> = {
    primary: "bg-pine-950 text-white hover:bg-pine-800",
    outline: "border border-outline bg-white hover:border-pine-800",
    ghost: "text-primary hover:bg-primary-container",
  };
  return `${base} ${styles[variant]}`;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`elev-1 rounded-lg border border-outline/60 bg-white ${className}`}>
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
        <span role="alert" className="mt-1 block text-xs font-medium text-error">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-on-surface-variant">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-outline bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={4}
      className={`w-full rounded-md border border-outline bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-outline bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function Badge({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  const styles = {
    info: "bg-info-container text-info",
    success: "bg-success-container text-success",
    warning: "bg-warning-container text-warning",
    error: "bg-error-container text-error",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function Price({ paisa }: { paisa: number }) {
  return <span className="font-bold">Rs {(paisa / 100).toLocaleString("en-NP", { maximumFractionDigits: 0 })}</span>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-outline bg-surface-container/50 p-8 text-center">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{body}</p>
    </div>
  );
}

export function PageHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="border-b border-outline/60 bg-pine-950 text-white">
      <div className="wrap py-10 md:py-14">
        <p className="text-xs font-extrabold tracking-[0.16em] text-marigold-300 uppercase">{eyebrow}</p>
        <h1 className="font-display mt-2 max-w-2xl text-3xl leading-tight font-semibold md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">{body}</p>
      </div>
    </div>
  );
}
