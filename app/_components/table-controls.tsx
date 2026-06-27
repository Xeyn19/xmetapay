"use client";

import { Download, RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterOption = {
  label: string;
  value: string;
};

export type ExportColumn<T> = {
  label: string;
  value: (row: T) => string | number | null | undefined;
};

export function DashboardTableControls({
  query,
  onQueryChange,
  searchPlaceholder,
  filters = [],
  onClear,
  onExport,
  exportDisabled,
  tone = "admin",
}: {
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: Array<{
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }>;
  onClear: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  tone?: "admin" | "parent";
}) {
  const isParent = tone === "parent";
  const controlClass = isParent
    ? "rounded-[10px] border-black/15 bg-[#f8f8f7] text-[13px] text-[#1a1a1a] focus:border-[#e64a19] focus:ring-[#e64a19]/10"
    : "rounded-lg border-black/15 bg-[#f7f8fa] text-[12.5px] text-[#0f1117] focus:border-[#e64a19] focus:ring-[#e64a19]/10";
  const buttonClass = isParent
    ? "rounded-[10px] text-[13px] font-medium"
    : "rounded-lg text-[12.5px] font-semibold";

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <label className={cn("flex min-h-11 min-w-0 items-center gap-2 border px-3 py-2 sm:min-w-[210px]", controlClass)}>
        <Search className={cn("shrink-0", isParent ? "size-4 text-[#9e9e9e]" : "size-[15px] text-[#9ba3b8]")} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9e9e9e]"
          placeholder={searchPlaceholder}
        />
      </label>

      {filters.map((filter) => (
        <select
          key={filter.label}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          className={cn("min-h-11 border px-3 outline-none transition focus:ring-3", controlClass)}
          aria-label={filter.label}
        >
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ))}

      <button
        type="button"
        onClick={onClear}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-1.5 border border-black/15 bg-white px-3.5 transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
          buttonClass,
          isParent ? "text-[#6b6b6b]" : "text-[#5a6070]",
        )}
      >
        <RotateCcw className="size-4" />
        Clear
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-1.5 border px-3.5 transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-60",
          buttonClass,
          isParent
            ? "border-[#e64a19] bg-[#e64a19] text-white hover:bg-[#bf360c]"
            : "border-[#0f1117] bg-[#0f1117] text-white hover:bg-[#2d3348]",
        )}
      >
        <Download className="size-4" />
        Export CSV
      </button>
    </div>
  );
}

export function filterByQuery<T>(rows: T[], query: string, getSearchText: (row: T) => string) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) => normalize(getSearchText(row)).includes(normalizedQuery));
}

export function toFilterOptions(values: string[], allLabel: string) {
  const uniqueValues = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return [
    { label: allLabel, value: "all" },
    ...uniqueValues.map((value) => ({ label: value, value })),
  ];
}

export function exportRowsToCsv<T>(filename: string, rows: T[], columns: ExportColumn<T>[]) {
  const csvRows = [
    columns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(",")),
  ];
  const blob = new Blob([csvRows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
