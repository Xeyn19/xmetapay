"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CellHook } from "jspdf-autotable";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, LoaderCircle, RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterOption = {
  label: string;
  value: string;
};

export type ExportColumn<T> = {
  label: string;
  value: (row: T) => string | number | null | undefined;
};

export type BrandedPdfField = {
  label: string;
  value: string | number;
};

export type BrandedPdfOptions = {
  orientation?: "portrait" | "landscape";
  context?: BrandedPdfField[];
  filters?: BrandedPdfField[];
  summary?: BrandedPdfField[];
};

export type BrandedPdfDocument = {
  doc: jsPDF;
  startY: number;
};

export const DEFAULT_TABLE_PAGE_SIZE = 10;
export const TABLE_PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

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
  onExportPdf?: () => void | Promise<void>;
  exportDisabled: boolean;
  tone?: "admin" | "parent";
}) {
  const [exportingPdf, setExportingPdf] = useState(false);
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
          onClick={async () => {
            if (exportingPdf) return;
            setExportingPdf(true);
            try {
              await onExportPdf();
            } finally {
              setExportingPdf(false);
            }
          }}
          disabled={exportDisabled || exportingPdf}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-1.5 border bg-white px-3.5 transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-60",
            buttonClass,
            isParent
              ? "border-[#e64a19] text-[#e64a19] hover:bg-[#fff3ee]"
              : "border-[#0f1117] text-[#0f1117] hover:bg-[#f2f1ef]",
          )}
        >
          {exportingPdf ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
          <span aria-live="polite">{exportingPdf ? "Generating PDF..." : "Export PDF"}</span>
        </button>
      ) : null}
    </div>
  );
}

export function DashboardTablePagination({
  page,
  pageSize,
  pageCount,
  totalItems,
  startItem,
  endItem,
  onPageChange,
  onPageSizeChange,
  tone = "admin",
}: {
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  tone?: "admin" | "parent";
}) {
  if (totalItems === 0) {
    return null;
  }

  const isParent = tone === "parent";
  const controlClass = isParent
    ? "rounded-[10px] border-black/15 bg-[#f8f8f7] text-[13px] text-[#1a1a1a] focus:border-[#e64a19] focus:ring-[#e64a19]/10"
    : "rounded-lg border-black/15 bg-[#f7f8fa] text-[12.5px] text-[#0f1117] focus:border-[#e64a19] focus:ring-[#e64a19]/10";
  const buttonClass = isParent
    ? "rounded-[10px] text-[13px] font-medium text-[#6b6b6b]"
    : "rounded-lg text-[12.5px] font-semibold text-[#5a6070]";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.07] px-[18px] py-3">
      <div className={isParent ? "text-[12px] text-[#6b6b6b]" : "text-[11.5px] text-[#5a6070]"}>
        Showing {startItem}-{endItem} of {totalItems}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className={isParent ? "text-[12px] text-[#6b6b6b]" : "text-[11.5px] text-[#5a6070]"}>
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className={cn("ml-2 min-h-9 border px-2 outline-none transition focus:ring-3", controlClass)}
            aria-label="Rows per page"
          >
            {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <span className={isParent ? "text-[12px] text-[#6b6b6b]" : "text-[11.5px] text-[#5a6070]"}>
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            "inline-flex min-h-9 items-center justify-center gap-1.5 border border-black/15 bg-white px-3 transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-50",
            buttonClass,
          )}
        >
          <ChevronLeft className="size-4" />
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className={cn(
            "inline-flex min-h-9 items-center justify-center gap-1.5 border border-black/15 bg-white px-3 transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-50",
            buttonClass,
          )}
        >
          Next
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function usePaginatedRows<T>(rows: T[], resetKey: string, initialPageSize = DEFAULT_TABLE_PAGE_SIZE) {
  const [paginationState, setPaginationState] = useState({
    page: 1,
    pageSize: initialPageSize,
    resetKey,
  });
  const pageSize = paginationState.pageSize;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const requestedPage = paginationState.resetKey === resetKey ? paginationState.page : 1;
  const safePage = clampPage(requestedPage, pageCount);
  const startIndex = rows.length === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rows.length);
  const pageRows = useMemo(() => rows.slice(startIndex, endIndex), [endIndex, rows, startIndex]);
  const setPage = (nextPage: number) => {
    setPaginationState((current) => ({
      ...current,
      page: clampPage(nextPage, pageCount),
      resetKey,
    }));
  };
  const setPageSize = (nextPageSize: number) => {
    setPaginationState({
      page: 1,
      pageSize: nextPageSize,
      resetKey,
    });
  };

  return {
    page: safePage,
    pageSize,
    pageCount,
    pageRows,
    totalItems: rows.length,
    startItem: rows.length === 0 ? 0 : startIndex + 1,
    endItem: endIndex,
    setPage,
    setPageSize,
  };
}

function clampPage(page: number, pageCount: number) {
  return Math.min(Math.max(1, page), pageCount);
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

export async function exportRowsToPdf<T>(
  filename: string,
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
  options: BrandedPdfOptions = {},
) {
  const { doc, startY } = await createBrandedPdfDocument(title, rows.length, {
    orientation: options.orientation ?? (columns.length > 6 ? "landscape" : "portrait"),
    ...options,
  });
  addBrandedPdfTable(doc, startY, columns.map((column) => column.label), rows.length > 0
    ? rows.map((row) => columns.map((column) => String(column.value(row) ?? "")))
    : [[
        "No records yet",
        ...Array.from({ length: Math.max(columns.length - 1, 0) }, () => ""),
      ]], columns.length);
  finalizeBrandedPdf(doc, filename);
}

export async function createBrandedPdfDocument(
  title: string,
  recordCount: number,
  options: BrandedPdfOptions = {},
): Promise<BrandedPdfDocument> {
  const doc = new jsPDF({
    orientation: options.orientation ?? "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadBrandLogo();

  doc.setFillColor(230, 74, 25);
  doc.rect(0, 0, pageWidth, 6, "F");

  if (logo) {
    doc.addImage(logo, "JPEG", 30, 22, 34, 34);
  } else {
    doc.setFillColor(230, 74, 25);
    doc.roundedRect(30, 22, 34, 34, 5, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("X", 47, 44, { align: "center" });
  }

  doc.setTextColor(15, 17, 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("XMETA Pay", 74, 36);
  doc.setFontSize(11);
  doc.text(cleanPdfText(title), 74, 52);

  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const baseFields: BrandedPdfField[] = [
    ...(options.context ?? []),
    { label: "Generated", value: generatedAt },
    { label: "Records", value: recordCount },
  ];
  const metadata = [...baseFields, ...(options.filters ?? [])].filter((field) => String(field.value).trim());
  let cursorY = 72;

  if (metadata.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 96, 112);
    const lines = metadata.map((field) => `${cleanPdfText(field.label)}: ${cleanPdfText(field.value)}`);
    const wrapped = doc.splitTextToSize(lines.join("   |   "), pageWidth - 60);
    doc.text(wrapped, 30, cursorY);
    cursorY += wrapped.length * 9 + 8;
  }

  if (options.summary?.length) {
    const gap = 8;
    const cardWidth = (pageWidth - 60 - gap * (options.summary.length - 1)) / options.summary.length;
    options.summary.forEach((metric, index) => {
      const x = 30 + index * (cardWidth + gap);
      doc.setFillColor(255, 247, 244);
      doc.setDrawColor(248, 205, 190);
      doc.roundedRect(x, cursorY, cardWidth, 38, 4, 4, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 96, 112);
      doc.text(cleanPdfText(metric.label), x + 8, cursorY + 13);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 17, 23);
      doc.text(cleanPdfText(metric.value), x + 8, cursorY + 29);
    });
    cursorY += 48;
  }

  return { doc, startY: cursorY + 4 };
}

export function addBrandedPdfTable(
  doc: jsPDF,
  startY: number,
  columns: string[],
  body: string[][],
  columnCount = columns.length,
  didParseCell?: CellHook,
) {
  autoTable(doc, {
    head: [columns],
    body,
    margin: { left: 30, right: 30, top: 42, bottom: 34 },
    startY,
    showHead: "everyPage",
    styles: {
      cellPadding: 3,
      fontSize: columnCount > 8 ? 6 : 7,
      overflow: "linebreak",
      textColor: [45, 51, 65],
      lineColor: [229, 231, 235],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [230, 74, 25],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 248, 247] },
    didParseCell,
  });
}

export function finalizeBrandedPdf(doc: jsPDF, filename: string) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(230, 74, 25);
    doc.setLineWidth(0.8);
    doc.line(30, pageHeight - 24, pageWidth - 30, pageHeight - 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 112);
    doc.text("XMETA Pay · School payment records", 30, pageHeight - 12);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 30, pageHeight - 12, { align: "right" });
  }
  doc.save(filename);
}

let brandLogoPromise: Promise<string | null> | null = null;

async function loadBrandLogo() {
  if (!brandLogoPromise) {
    brandLogoPromise = fetch("/xmetapay-logo.jpg")
      .then((response) => {
        if (!response.ok) throw new Error("Brand logo unavailable");
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch(() => null);
  }
  return brandLogoPromise;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function cleanPdfText(value: string | number) {
  return String(value).replaceAll(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
