import type { ReactNode } from "react";
import { cn } from "../lib/format";
import { Card, PageHero } from "./ui";

/** Big tabular KPI figure. Color is reserved for meaning via tone. */
export function Kpi({
  value,
  label,
  sub,
  tone = "pine",
}: {
  value: string;
  label: string;
  sub?: string;
  tone?: "pine" | "marigold" | "success" | "error";
}) {
  const bar =
    tone === "marigold"
      ? "border-t-marigold-500"
      : tone === "success"
        ? "border-t-success"
        : tone === "error"
          ? "border-t-error"
          : "border-t-pine-800";
  return (
    <Card className={cn("border-t-4 p-5", bar)}>
      <p className="font-display text-[28px] leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-extrabold tracking-[0.12em] text-on-surface-variant uppercase">
        {label}
      </p>
      {sub && <p className="mt-1 text-xs text-on-surface-variant">{sub}</p>}
    </Card>
  );
}

/** Ops console shell: dark sidebar nav on desktop, scroll tabs on mobile. */
export function OpsShell<T extends string>({
  eyebrow,
  title,
  body,
  badge,
  tabs,
  value,
  onChange,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  badge?: ReactNode;
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  children: ReactNode;
}) {
  return (
    <div className="fade-up">
      <PageHero eyebrow={eyebrow} title={title} body={body}>
        {badge}
      </PageHero>
      <div className="wrap py-8">
        <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <nav
            aria-label="Sections"
            className="elev-1 sticky top-32 hidden rounded-lg border border-outline/80 bg-white p-2 lg:block"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                aria-current={value === t.id ? "page" : undefined}
                onClick={() => onChange(t.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3.5 py-2.5 text-sm font-semibold transition",
                  value === t.id
                    ? "bg-pine-950 text-white"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                      value === t.id ? "bg-marigold-300 text-pine-950" : "bg-surface-container text-on-surface-variant",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div
            role="tablist"
            aria-label="Sections"
            className="flex gap-1 overflow-x-auto border-b-2 border-outline/70 lg:hidden"
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
                    : "text-on-surface-variant",
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 ? ` (${t.count})` : ""}
              </button>
            ))}
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton blocks for async surfaces. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-outline bg-white p-5">
          <div className="h-5 w-1/3 rounded bg-surface-container-high" />
          <div className="mt-2 h-4 w-2/3 rounded bg-surface-container" />
        </div>
      ))}
    </div>
  );
}
