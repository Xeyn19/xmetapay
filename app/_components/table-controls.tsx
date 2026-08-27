"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CellHook } from "jspdf-autotable";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, LoaderCircle, RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { readableDisabledControlClass } from "@/lib/ui/control-styles";
import { PRODUCT_EXPORT_SLUG, PRODUCT_NAME } from "@/lib/brand";

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

export type BrandedExcelOptions = {
  worksheetName?: string;
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
  exportLabel = "Export CSV",
  exportingLabel = "Generating export...",
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
  onExport: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  exportDisabled: boolean;
  tone?: "admin" | "parent";
  exportLabel?: string;
  exportingLabel?: string;
}) {
  const [exportingPrimary, setExportingPrimary] = useState(false);
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
        onClick={async () => {
          if (exportingPrimary) return;
          setExportingPrimary(true);
          try {
            await onExport();
          } finally {
            setExportingPrimary(false);
          }
        }}
        disabled={exportDisabled || exportingPrimary}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-1.5 border px-3.5 transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
          buttonClass,
          isParent
            ? "border-[#e64a19] bg-[#e64a19] text-white hover:bg-[#bf360c] disabled:pointer-events-none disabled:opacity-60"
            : cn("border-[#0f1117] bg-[#0f1117] text-white hover:bg-[#2d3348]", readableDisabledControlClass),
        )}
      >
        {exportingPrimary ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        <span aria-live="polite">{exportingPrimary ? exportingLabel : exportLabel}</span>
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
            "inline-flex min-h-11 items-center justify-center gap-1.5 border border-primary bg-card px-3.5 text-primary transition hover:bg-button-soft hover:text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
            buttonClass,
            isParent ? "disabled:pointer-events-none disabled:opacity-60" : readableDisabledControlClass,
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
            "inline-flex min-h-9 items-center justify-center gap-1.5 border border-black/15 bg-white px-3 transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
            buttonClass,
            isParent ? "disabled:pointer-events-none disabled:opacity-50" : readableDisabledControlClass,
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
            "inline-flex min-h-9 items-center justify-center gap-1.5 border border-black/15 bg-white px-3 transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
            buttonClass,
            isParent ? "disabled:pointer-events-none disabled:opacity-50" : readableDisabledControlClass,
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

export async function exportRowsToExcel<T>(
  filename: string,
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
  options: BrandedExcelOptions = {},
) {
  const ExcelJS = await import("exceljs");
  const Workbook = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(cleanWorksheetName(options.worksheetName ?? title), {
    pageSetup: {
      orientation: columns.length > 6 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    properties: { defaultRowHeight: 18 },
  });
  const columnCount = Math.max(columns.length, 1);
  const lastColumn = worksheet.getColumn(columnCount).letter;
  const logo = await loadBrandLogo();

  workbook.creator = PRODUCT_NAME;
  workbook.company = PRODUCT_NAME;
  workbook.title = cleanSpreadsheetText(title);
  workbook.created = new Date();

  worksheet.mergeCells(`B1:${lastColumn}1`);
  worksheet.mergeCells(`B2:${lastColumn}2`);
  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 22;
  worksheet.getCell("B1").value = PRODUCT_NAME;
  worksheet.getCell("B1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF0F1117" } };
  worksheet.getCell("B2").value = cleanSpreadsheetText(title);
  worksheet.getCell("B2").font = { name: "Arial", size: 12, bold: true, color: { argb: "FFE64A19" } };

  if (logo) {
    const logoId = workbook.addImage({ base64: logo, extension: "jpeg" });
    worksheet.addImage(logoId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 42, height: 42 } });
  } else {
    worksheet.getCell("A1").value = "X";
    worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE64A19" } };
  }

  let cursor = 4;
  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  cursor = addExcelMetadataRow(worksheet, cursor, columnCount, [
    { label: "Generated", value: generatedAt },
    { label: "Records", value: rows.length },
  ]);

  if (options.context?.length) {
    cursor = addExcelMetadataRow(worksheet, cursor, columnCount, options.context);
  }
  if (options.filters?.length) {
    cursor = addExcelMetadataRow(worksheet, cursor, columnCount, options.filters);
  }
  if (options.summary?.length) {
    cursor += 1;
    cursor = addExcelSummary(worksheet, cursor, columnCount, options.summary);
  }

  const headerRowNumber = cursor + 1;
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = cleanSpreadsheetText(column.label);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE64A19" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = excelBorder("FFF1C3B5");
  });
  headerRow.height = 24;

  if (rows.length > 0) {
    rows.forEach((row, rowIndex) => {
      const dataRow = worksheet.getRow(headerRowNumber + rowIndex + 1);
      columns.forEach((column, columnIndex) => {
        const cell = dataRow.getCell(columnIndex + 1);
        cell.value = cleanSpreadsheetText(column.value(row) ?? "");
        cell.numFmt = "@";
        cell.font = { name: "Arial", size: 9, color: { argb: "FF2D3348" } };
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = excelBorder("FFE5E7EB");
        if (rowIndex % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F7" } };
        }
      });
    });
  } else {
    const emptyRow = worksheet.getRow(headerRowNumber + 1);
    emptyRow.getCell(1).value = "No records yet";
    emptyRow.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF5A6070" } };
    if (columnCount > 1) worksheet.mergeCells(headerRowNumber + 1, 1, headerRowNumber + 1, columnCount);
  }

  columns.forEach((column, index) => {
    const values = rows.map((row) => cleanSpreadsheetText(column.value(row) ?? ""));
    const contentWidth = Math.max(cleanSpreadsheetText(column.label).length, ...values.map((value) => value.length));
    worksheet.getColumn(index + 1).width = Math.min(Math.max(contentWidth + 2, 12), 36);
  });
  worksheet.views = [{ state: "frozen", ySplit: headerRowNumber, activeCell: `A${headerRowNumber + 1}` }];
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: columnCount },
  };
  worksheet.headerFooter.oddFooter = `&L${PRODUCT_NAME}&RPage &P of &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(cleanExcelFilename(filename), blob);
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
  doc.text(PRODUCT_NAME, 74, 36);
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
    doc.text(`${PRODUCT_NAME} · School payment records`, 30, pageHeight - 12);
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

function addExcelMetadataRow(
  worksheet: import("exceljs").Worksheet,
  rowNumber: number,
  columnCount: number,
  fields: BrandedPdfField[],
) {
  const text = fields
    .filter((field) => cleanSpreadsheetText(field.value))
    .map((field) => `${cleanSpreadsheetText(field.label)}: ${cleanSpreadsheetText(field.value)}`)
    .join("   |   ");
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const cell = worksheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.font = { name: "Arial", size: 9, color: { argb: "FF5A6070" } };
  cell.alignment = { vertical: "middle", wrapText: true };
  worksheet.getRow(rowNumber).height = 21;
  return rowNumber + 1;
}

function addExcelSummary(
  worksheet: import("exceljs").Worksheet,
  rowNumber: number,
  columnCount: number,
  fields: BrandedPdfField[],
) {
  const span = Math.max(Math.floor(columnCount / fields.length), 1);
  fields.forEach((field, index) => {
    const startColumn = Math.min(index * span + 1, columnCount);
    const endColumn = index === fields.length - 1 ? columnCount : Math.min(startColumn + span - 1, columnCount);
    if (endColumn > startColumn) {
      worksheet.mergeCells(rowNumber, startColumn, rowNumber, endColumn);
      worksheet.mergeCells(rowNumber + 1, startColumn, rowNumber + 1, endColumn);
    }
    const labelCell = worksheet.getCell(rowNumber, startColumn);
    const valueCell = worksheet.getCell(rowNumber + 1, startColumn);
    labelCell.value = cleanSpreadsheetText(field.label);
    valueCell.value = cleanSpreadsheetText(field.value);
    labelCell.font = { name: "Arial", size: 8, color: { argb: "FF5A6070" } };
    valueCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F1117" } };
    for (let column = startColumn; column <= endColumn; column += 1) {
      for (const row of [rowNumber, rowNumber + 1]) {
        const cell = worksheet.getCell(row, column);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7F4" } };
        cell.border = excelBorder("FFF8CDBE");
        cell.alignment = { vertical: "middle", wrapText: true };
      }
    }
  });
  return rowNumber + 3;
}

function excelBorder(color: string): Partial<import("exceljs").Borders> {
  const side = { style: "thin" as const, color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

function cleanSpreadsheetText(value: string | number) {
  return String(value).replaceAll(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
}

function cleanWorksheetName(value: string) {
  const cleaned = cleanSpreadsheetText(value).replaceAll(/[\\/*?:[\]]/g, " ").slice(0, 31).trim();
  return cleaned || PRODUCT_NAME;
}

function cleanExcelFilename(value: string) {
  const cleaned = value.replaceAll(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replaceAll(/^\.+|\.+$/g, "");
  const filename = cleaned || `${PRODUCT_EXPORT_SLUG}-export.xlsx`;
  return filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
