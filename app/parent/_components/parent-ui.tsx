import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ParentMetric, ParentTone } from "../_data/parent-portal-data";

const toneText: Record<ParentTone, string> = {
  orange: "text-[#e64a19]",
  green: "text-[#2e7d32]",
  red: "text-[#c62828]",
  blue: "text-[#1565c0]",
  amber: "text-[#e65100]",
  muted: "text-[#6b6b6b]",
};

const pillClass: Record<ParentTone, string> = {
  orange: "bg-[#fbe9e7] text-[#e64a19]",
  green: "bg-[#e8f5e9] text-[#2e7d32]",
  red: "bg-[#ffebee] text-[#c62828]",
  blue: "bg-[#e3f2fd] text-[#1565c0]",
  amber: "bg-[#fff3e0] text-[#e65100]",
  muted: "bg-[#f2f1ef] text-[#6b6b6b]",
};

export function ParentButton({
  children,
  tone = "outline",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "outline" | "primary" | "ghost" }) {
  const tones = {
    outline: "border-black/15 bg-white text-[#6b6b6b] hover:bg-[#f2f1ef]",
    primary: "border-[#e64a19] bg-[#e64a19] text-white hover:bg-[#bf360c]",
    ghost: "border-transparent bg-transparent text-[#6b6b6b] hover:bg-[#f2f1ef]",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-medium transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-60",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:mb-6 xl:grid-cols-4">{children}</div>;
}

export function MetricCard({ metric }: { metric: ParentMetric }) {
  return (
    <section className="rounded-xl border border-black/[0.08] bg-white px-4 py-4 sm:px-5 sm:py-[18px]">
      {metric.accent ? <span className="float-right -mt-1 h-7 w-[3px] rounded-full bg-[#e64a19]" /> : null}
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#6b6b6b]">
        {metric.label}
      </div>
      <div className={cn("mb-1 text-2xl font-semibold leading-tight sm:text-[26px]", toneText[metric.tone ?? "orange"])}>
        {metric.value}
      </div>
      <div className={cn("text-xs leading-5", metric.tone === "green" ? "text-[#2e7d32]" : metric.tone === "red" ? "text-[#c62828]" : "text-[#6b6b6b]")}>
        {metric.note}
      </div>
    </section>
  );
}

export function ParentAlert({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-start gap-2.5 rounded-xl border border-[#c62828]/20 bg-[#ffebee] px-3.5 py-3 text-[13px] leading-5 text-[#c62828] sm:items-center sm:px-4">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold sm:mt-0">!</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ParentCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-black/[0.08] bg-white", className)}>
      <header className="flex flex-col gap-3 border-b border-black/[0.08] px-4 py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-5">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold leading-5 text-[#1a1a1a]">
          {Icon ? <Icon className="size-[17px] shrink-0 text-[#e64a19]" /> : null}
          {title}
        </h2>
        {action}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatusPill({ tone, children }: { tone: ParentTone; children: ReactNode }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", pillClass[tone])}>{children}</span>;
}

export function FeeRow({
  icon: Icon,
  title,
  desc,
  amount,
  status,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  amount: string;
  status?: string;
  tone?: ParentTone;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-black/[0.08] px-4 py-4 last:border-b-0 hover:bg-[#f8f8f7] min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#fbe9e7] text-[#e64a19]">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-medium leading-5 text-[#1a1a1a]">{title}</div>
          <div className="mt-0.5 text-xs leading-5 text-[#6b6b6b]">{desc}</div>
        </div>
      </div>
      <div className="shrink-0 text-left min-[420px]:text-right">
        <div className="font-semibold text-[#1a1a1a]">{amount}</div>
        {status && tone ? <div className="mt-1"><StatusPill tone={tone}>{status}</StatusPill></div> : children}
      </div>
    </div>
  );
}

export function ParentTable({
  headers,
  children,
}: {
  headers: Array<{ label: string; className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="min-w-[680px] w-full table-fixed border-collapse text-[13px]">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header.label}
                className={cn(
                "border-b border-black/[0.08] bg-[#f8f8f7] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6b6b6b]",
                  header.className
                )}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-black/[0.08] [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td]:whitespace-nowrap [&_td]:overflow-hidden [&_td]:text-ellipsis [&_tr:hover_td]:bg-[#f8f8f7]">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function DetailRows({ rows }: { rows: Array<{ label: string; value: string; tone?: ParentTone }> }) {
  return (
    <div className="divide-y divide-black/[0.08]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3 py-2.5 text-[13px] leading-5">
          <span className="text-[#6b6b6b]">{row.label}</span>
          <span className={cn("text-right font-semibold text-[#1a1a1a]", row.tone && toneText[row.tone])}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ParentField({
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
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6b6b6b]">
        {label} {required ? <span className="text-[#e64a19]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export const parentControlClass =
  "min-h-11 rounded-[10px] border border-black/15 bg-white px-3 text-[13px] text-[#1a1a1a] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10";

export function VisualCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border",
        checked ? "border-[#e64a19] bg-[#e64a19] text-white" : "border-black/20 bg-white"
      )}
    >
      {checked ? <Check className="size-3.5" /> : null}
    </span>
  );
}

export function MethodCard({
  selected,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20",
        selected ? "border-[#e64a19] bg-[#fbe9e7]" : "border-black/[0.08] bg-white hover:bg-[#f8f8f7]"
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-white text-[#e64a19]">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[#1a1a1a]">{title}</span>
        <span className="mt-0.5 block text-xs text-[#6b6b6b]">{desc}</span>
      </span>
      <span className="flex size-5 items-center justify-center rounded-full border border-[#e64a19]">
        {selected ? <span className="size-2.5 rounded-full bg-[#e64a19]" /> : null}
      </span>
    </button>
  );
}

export function SearchBox({ placeholder }: { placeholder: string }) {
  return (
    <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-[10px] border border-black/15 bg-[#f8f8f7] px-3 py-2 text-[13px] sm:min-w-[210px]">
      <Search className="size-4 text-[#9e9e9e]" />
      <input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9e9e9e]" placeholder={placeholder} readOnly />
    </label>
  );
}

