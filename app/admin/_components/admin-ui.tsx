import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Kpi, StatusTone, Tone } from "../_data/admin-dashboard-data";

const toneBorder: Record<Tone, string> = {
  orange: "before:bg-[#e64a19]",
  green: "before:bg-[#43a047]",
  red: "before:bg-[#c62828]",
  blue: "before:bg-[#1565c0]",
  purple: "before:bg-[#6a1b9a]",
  teal: "before:bg-[#00695c]",
};

const noteToneClass = {
  default: "text-[#5a6070]",
  up: "text-[#2e7d32]",
  warn: "text-[#f57c00]",
  danger: "text-[#c62828]",
};

const pillClass: Record<StatusTone, string> = {
  paid: "bg-[#e8f5e9] text-[#2e7d32]",
  partial: "bg-[#fff3e0] text-[#f57c00]",
  unpaid: "bg-[#ffebee] text-[#c62828]",
  enrolled: "bg-[#e3f2fd] text-[#1565c0]",
  active: "bg-[#e8f5e9] text-[#2e7d32]",
  inactive: "bg-[#eff1f5] text-[#5a6070]",
  pending: "bg-[#f3e5f5] text-[#6a1b9a]",
  low: "bg-[#fff3e0] text-[#f57c00]",
  online: "bg-[#e0f2f1] text-[#00695c]",
};

const valueToneClass = {
  default: "text-[#0f1117]",
  green: "text-[#2e7d32]",
  red: "text-[#c62828]",
  orange: "text-[#e64a19]",
  blue: "text-[#1565c0]",
};

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function KpiCard({ label, value, note, tone, noteTone = "default", icon: Icon }: Kpi) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-black/[0.07] bg-white px-4 py-4 sm:px-[18px]",
        "before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
        toneBorder[tone]
      )}
    >
      {Icon ? <Icon className="absolute right-3.5 top-3.5 size-[22px] text-[#0f1117]/10" /> : null}
      <div className="mb-1.5 pr-8 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#9ba3b8]">
        {label}
      </div>
      <div className="mb-1 text-2xl font-bold leading-tight text-[#0f1117]">
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
    danger: "border-[#c62828]/15 bg-[#ffebee] text-[#c62828]",
    warn: "border-[#f57c00]/20 bg-[#fff3e0] text-[#f57c00]",
    info: "border-[#1565c0]/15 bg-[#e3f2fd] text-[#1565c0]",
    success: "border-[#2e7d32]/15 bg-[#e8f5e9] text-[#2e7d32]",
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
    <section id={id} className={cn("overflow-hidden rounded-xl border border-black/[0.07] bg-white", className)}>
      <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-[18px]">
        <h2 className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-[#0f1117]">
          {Icon ? <Icon className="size-[17px] shrink-0 text-[#e64a19]" /> : null}
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
  headers: Array<{ label: string; className?: string }>;
  children: ReactNode;
}) {
  return (
    <TableShell>
      <table className="min-w-[700px] w-full table-fixed border-collapse text-[12.5px]">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header.label}
                className={cn(
                  "border-b border-black/[0.07] bg-[#f7f8fa] px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.04em] text-[#9ba3b8]",
                  header.className
                )}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-black/[0.07] [&_td]:px-3.5 [&_td]:py-3 [&_td]:align-middle [&_td]:last:border-b-0 [&_td]:whitespace-nowrap [&_td]:overflow-hidden [&_td]:text-ellipsis [&_tr:hover_td]:bg-[#f7f8fa]">
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
    orange: "bg-[#e64a19]",
    green: "bg-[#43a047]",
    blue: "bg-[#1565c0]",
  };

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="grid grid-cols-[minmax(52px,70px)_1fr_minmax(58px,68px)] items-center gap-2.5">
          <span className="min-w-0 text-[11.5px] font-medium leading-4 text-[#5a6070]">{row.label}</span>
          <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#eff1f5]">
            <span
              className={cn("block h-full rounded-full", fillClass[row.tone ?? tone])}
              style={{ width: `${row.percent}%` }}
            />
          </span>
          <span className="text-right text-[11.5px] font-bold text-[#0f1117]">{row.value}</span>
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
    <div className="divide-y divide-black/[0.07]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 text-[12.5px] leading-5">
          <span className="min-w-0 text-[#5a6070]">{row.label}</span>
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
    orange: "bg-[#e64a19]",
    green: "bg-[#43a047]",
    gray: "bg-[#eff1f5] ring-1 ring-black/10",
  };
  return (
    <div className="space-y-3.5">
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span className={cn("mt-1 size-2.5 rounded-full", dot[item.tone])} />
            {index < items.length - 1 ? <span className="my-1 w-px flex-1 bg-black/[0.07]" /> : null}
          </div>
          <div className="min-w-0 pb-1">
            <div className="text-[12.5px] font-bold leading-5 text-[#0f1117]">{item.title}</div>
            <div className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">{item.detail}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-[#9ba3b8]">{item.time}</div>
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
    <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-black/15 bg-[#f7f8fa] px-3 py-2 text-[12.5px] sm:min-w-[200px]">
      <Search className="size-[15px] shrink-0 text-[#9ba3b8]" />
      <input
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[#0f1117] outline-none placeholder:text-[#9ba3b8]"
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
    <div className="flex gap-0.5 overflow-x-auto rounded-lg bg-[#eff1f5] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          data-tab-value={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "min-h-9 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-semibold text-[#5a6070] transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20",
            active === tab.value && "bg-white text-[#0f1117] shadow-sm"
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
    outline: "border-black/15 bg-white text-[#5a6070] hover:bg-[#eff1f5]",
    primary: "border-[#e64a19] bg-[#e64a19] text-white hover:bg-[#bf360c]",
    dark: "border-[#0f1117] bg-[#0f1117] text-white hover:bg-[#2d3348]",
    ghost: "border-transparent bg-transparent text-[#5a6070] hover:bg-[#eff1f5]",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-60",
        toneClasses[tone],
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
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
        {label} {required ? <span className="text-[#e64a19]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export const fieldControlClass =
  "min-h-11 rounded-lg border border-black/15 bg-white px-3 text-[13px] text-[#0f1117] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 bg-[#f7f8fa] px-4 py-8 text-center text-[12.5px] text-[#5a6070]">
      {children}
    </div>
  );
}
