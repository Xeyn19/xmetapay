import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Search } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { readableDisabledControlClass } from "@/lib/ui/control-styles";
import type { Kpi, StatusTone, Tone } from "../_data/admin-dashboard-data";

const toneBorder: Record<Tone, string> = {
  orange: "before:bg-primary",
  green: "before:bg-status-success-foreground",
  red: "before:bg-status-danger-foreground",
  blue: "before:bg-status-info-foreground",
  purple: "before:bg-status-pending-foreground",
  teal: "before:bg-secondary-foreground",
};

const noteToneClass = {
  default: "text-muted-foreground",
  up: "text-status-success-foreground",
  warn: "text-status-warning-foreground",
  danger: "text-status-danger-foreground",
};

const pillClass: Record<StatusTone, string> = {
  paid: "bg-status-success-bg text-status-success-foreground",
  partial: "bg-status-warning-bg text-status-warning-foreground",
  unpaid: "bg-status-danger-bg text-status-danger-foreground",
  enrolled: "bg-status-info-bg text-status-info-foreground",
  active: "bg-status-success-bg text-status-success-foreground",
  inactive: "bg-status-inactive-bg text-status-inactive-foreground",
  pending: "bg-status-pending-bg text-status-pending-foreground",
  low: "bg-status-warning-bg text-status-warning-foreground",
  online: "bg-status-info-bg text-status-info-foreground",
};

const valueToneClass = {
  default: "text-foreground",
  green: "text-status-success-foreground",
  red: "text-status-danger-foreground",
  orange: "text-primary",
  blue: "text-status-info-foreground",
};

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function KpiCard({ label, value, note, tone, noteTone = "default", icon: Icon }: Kpi) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card px-4 py-4 text-card-foreground sm:px-[18px]",
        "before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
        toneBorder[tone]
      )}
    >
      {Icon ? <Icon className="absolute right-3.5 top-3.5 size-[22px] text-muted-foreground/30" /> : null}
      <div className="mb-1.5 pr-8 text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </div>
      <div className="mb-1 text-2xl font-bold leading-tight text-foreground">
        {value}
      </div>
      <div className={cn("text-[11.5px] leading-5", noteToneClass[noteTone])}>{note}</div>
    </section>
  );
}

export function AlertBanner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "danger" | "warn" | "info" | "success";
  icon: LucideIcon;
  children: ReactNode;
}) {
  const classes = {
    danger: "border-status-danger-foreground/20 bg-status-danger-bg text-status-danger-foreground",
    warn: "border-status-warning-foreground/25 bg-status-warning-bg text-status-warning-foreground",
    info: "border-status-info-foreground/20 bg-status-info-bg text-status-info-foreground",
    success: "border-status-success-foreground/20 bg-status-success-bg text-status-success-foreground",
  };

  return (
    <div className={cn("mb-3.5 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[12.5px] leading-5", classes[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DashboardCard({
  title,
  icon: Icon,
  action,
  children,
  id,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section id={id} className={cn("overflow-hidden rounded-xl border border-border bg-card text-card-foreground", className)}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-[18px]">
        <h2 className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-foreground">
          {Icon ? <Icon className="size-[17px] shrink-0 text-primary" /> : null}
          {title}
        </h2>
        {action}
      </div>
      <div className={cn("p-[18px]", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold leading-5", pillClass[tone])}>
      {children}
    </span>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto overscroll-x-contain">{children}</div>;
}

export function AdminTable({
  headers,
  children,
}: {
  headers: Array<{ key?: string; label: ReactNode; className?: string }>;
  children: ReactNode;
}) {
  return (
    <TableShell>
      <table className="min-w-[700px] w-full table-fixed border-collapse text-[12.5px]">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header.key ?? (typeof header.label === "string" ? header.label : `header-${index}`)}
                className={cn(
                  "border-b border-border bg-muted px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground",
                  header.className
                )}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:px-3.5 [&_td]:py-3 [&_td]:align-middle [&_td]:last:border-b-0 [&_td]:whitespace-nowrap [&_td]:overflow-hidden [&_td]:text-ellipsis [&_tr:hover_td]:bg-muted/70">
          {children}
        </tbody>
      </table>
    </TableShell>
  );
}

export function BarList({
  rows,
  tone = "orange",
}: {
  rows: Array<{ label: string; value: string; percent: number; tone?: "orange" | "green" | "blue" }>;
  tone?: "orange" | "green" | "blue";
}) {
  const fillClass = {
    orange: "bg-primary",
    green: "bg-status-success-foreground",
    blue: "bg-status-info-foreground",
  };

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="grid grid-cols-[minmax(52px,70px)_1fr_minmax(58px,68px)] items-center gap-2.5">
          <span className="min-w-0 text-[11.5px] font-medium leading-4 text-muted-foreground">{row.label}</span>
          <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", fillClass[row.tone ?? tone])}
              style={{ width: `${row.percent}%` }}
            />
          </span>
          <span className="text-right text-[11.5px] font-bold text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function SummaryRows({
  rows,
}: {
  rows: Array<{ label: string; value: string; tone?: "default" | "green" | "red" | "orange" | "blue" }>;
}) {
  return (
    <div className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 text-[12.5px] leading-5">
          <span className="min-w-0 text-muted-foreground">{row.label}</span>
          <span className={cn("shrink-0 text-right font-bold", valueToneClass[row.tone ?? "default"])}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Timeline({
  items,
}: {
  items: Array<{ id: number; title: string; detail: string; time: string; tone: "orange" | "green" | "gray" }>;
}) {
  const dot = {
    orange: "bg-primary",
    green: "bg-status-success-foreground",
    gray: "bg-muted ring-1 ring-border",
  };
  return (
    <div className="space-y-3.5">
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span className={cn("mt-1 size-2.5 rounded-full", dot[item.tone])} />
            {index < items.length - 1 ? <span className="my-1 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="min-w-0 pb-1">
            <div className="text-[12.5px] font-bold leading-5 text-foreground">{item.title}</div>
            <div className="mt-0.5 text-[11.5px] leading-5 text-muted-foreground">{item.detail}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">{item.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  readOnly?: boolean;
}) {
  return (
    <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-[12.5px] sm:min-w-[200px]">
      <Search className="size-[15px] shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ label: string; value: T }>;
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-0.5 overflow-x-auto rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          data-tab-value={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "min-h-11 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            active === tab.value && "bg-card text-foreground shadow-sm"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function AdminButton({
  children,
  tone = "outline",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "outline" | "primary" | "dark" | "ghost";
}) {
  const toneClasses = {
    outline: "border-border bg-card text-foreground hover:bg-muted",
    primary: "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
    dark: "border-button-secondary bg-button-secondary text-button-secondary-foreground hover:bg-button-secondary-hover",
    ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        toneClasses[tone],
        readableDisabledControlClass,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  required,
  className,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        {label} {required ? <span className="text-primary">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export const fieldControlClass =
  "min-h-11 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-ring/40";

export function EmptyState({
  children,
  title,
  detail,
  action,
}: {
  children?: ReactNode;
  title?: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
      {title ? <div className="font-bold text-foreground">{title}</div> : null}
      {detail ? <div className="mx-auto mt-1 max-w-xl leading-5">{detail}</div> : null}
      {children}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AdminWorkflowHeader({
  backHref,
  backLabel,
  title,
  description,
  status,
  action,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  status?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <div className="mt-1 flex flex-col gap-4 min-[560px]:flex-row min-[560px]:items-start min-[560px]:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">{title}</h2>
            {status}
          </div>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
