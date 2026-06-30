"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, FileText, RotateCcw, Search } from "lucide-react";

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
  onExportPdf,
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
  onExportPdf?: () => void;
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
      {onExportPdf ? (
        <button
          type="button"
          onClick={onExportPdf}
          disabled={exportDisabled}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-1.5 border bg-white px-3.5 transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-60",
            buttonClass,
            isParent
              ? "border-[#e64a19] text-[#e64a19] hover:bg-[#fff3ee]"
              : "border-[#0f1117] text-[#0f1117] hover:bg-[#f2f1ef]",
          )}
        >
          <FileText className="size-4" />
          Export PDF
        </button>
      ) : null}
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

export function exportRowsToPdf<T>(filename: string, title: string, rows: T[], columns: ExportColumn<T>[]) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("XMETA Pay", 14, 16);
  doc.setFontSize(12);
  doc.text(title, 14, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${generatedAt}`, 14, 30);

  autoTable(doc, {
    head: [columns.map((column) => column.label)],
    body: rows.length > 0
      ? rows.map((row) => columns.map((column) => String(column.value(row) ?? "")))
      : [[
          "No records yet",
          ...Array.from({ length: Math.max(columns.length - 1, 0) }, () => ""),
        ]],
    margin: { left: 14, right: 14 },
    startY: 36,
    styles: {
      cellPadding: 2,
      fontSize: columns.length > 8 ? 6 : 7,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [230, 74, 25],
      textColor: [255, 255, 255],
    },
  });

  doc.save(filename);
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
