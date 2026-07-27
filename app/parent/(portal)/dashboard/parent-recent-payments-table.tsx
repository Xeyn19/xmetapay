"use client";

import { useMemo, useState } from "react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  type ExportColumn,
  exportRowsToExcel,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import type { ParentDashboardPayment } from "@/lib/students/records";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

export function ParentRecentPaymentsTable({ rows }: { rows: ParentDashboardPayment[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => status === "all" || row.status === status),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}`);
  const exportColumns: ExportColumn<ParentDashboardPayment>[] = [
    { label: "Reference", value: (row) => row.referenceNumber },
    { label: "Student", value: (row) => row.studentName },
    { label: "Description", value: (row) => row.description },
    { label: "Amount", value: (row) => row.amount },
    { label: "Status", value: (row) => row.status },
  ];
  const exportOptions = {
    filters: [
      { label: "Search", value: query.trim() || "All payments" },
      { label: "Status", value: status === "all" ? "All" : status },
    ],
    summary: [
      { label: "Payments", value: filteredRows.length },
      { label: "Total amount", value: formatMoney(filteredRows.reduce((total, row) => total + parseMoney(row.amount), 0)) },
    ],
  };

  return (
    <>
      <div className="border-b border-black/[0.08] px-4 py-3 sm:px-5">
        <DashboardTableControls
          tone="parent"
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search payments..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
          }}
          onExport={() => exportRowsToExcel("parent-recent-payments.xlsx", "Recent payments", filteredRows, exportColumns, {
            worksheetName: "Recent payments",
            ...exportOptions,
          })}
          onExportPdf={() => exportRowsToPdf("parent-recent-payments.pdf", "Recent payments", filteredRows, exportColumns, exportOptions)}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <ParentTable
        headers={[
          { label: "Ref #", className: "w-[20%]" },
          { label: "Student", className: "w-[22%]" },
          { label: "Description", className: "w-[26%]" },
          { label: "Amount", className: "w-[16%]" },
          { label: "Status", className: "w-[16%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((payment) => (
            <tr key={payment.referenceNumber}>
              <td className="font-mono text-[11px] text-[#6b6b6b]">{payment.referenceNumber}</td>
              <td className="font-medium">{payment.studentName}</td>
              <td>{payment.description}</td>
              <td className="font-semibold">{payment.amount}</td>
              <td><StatusPill tone={payment.status === "Paid" ? "green" : "amber"}>{payment.status}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className="text-center text-[#6b6b6b]">
              {rows.length === 0 ? "No payment records yet." : "No payment records match the current filters."}
            </td>
          </tr>
        )}
      </ParentTable>
      <DashboardTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        tone="parent"
      />
    </>
  );
}

function parseMoney(value: string) {
  const parsed = Number(value.replaceAll(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return `P${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
