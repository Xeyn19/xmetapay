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
import type { ParentWalletActivity } from "@/lib/students/records";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

export function ParentWalletActivityTable({
  rows,
  excelFilename = "parent-wallet-activity.xlsx",
  pdfFilename = "parent-wallet-activity.pdf",
  exportTitle = "Wallet activity",
  worksheetName = "Wallet activity",
  showStudent = true,
  compactPreview = false,
}: {
  rows: ParentWalletActivity[];
  excelFilename?: string;
  pdfFilename?: string;
  exportTitle?: string;
  worksheetName?: string;
  showStudent?: boolean;
  compactPreview?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => (
        (status === "all" || row.status === status) &&
        (channel === "all" || row.channel === channel)
      )),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [channel, query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}|${channel}`);
  const headers = showStudent
    ? [
      { label: "Date", className: "w-[14%]" },
      { label: "Student", className: "w-[16%]" },
      { label: "Description", className: "w-[22%]" },
      { label: "Channel", className: "w-[14%]" },
      { label: "Amount", className: "w-[10%]" },
      { label: "Balance", className: "w-[12%]" },
      { label: "Status", className: "w-[12%]" },
    ]
    : [
      { label: "Date", className: "w-[16%]" },
      { label: "Description", className: "w-[28%]" },
      { label: "Channel", className: "w-[16%]" },
      { label: "Amount", className: "w-[12%]" },
      { label: "Balance", className: "w-[14%]" },
      { label: "Status", className: "w-[14%]" },
    ];
  const exportColumns: ExportColumn<ParentWalletActivity>[] = [
    ...(showStudent ? [{ label: "Student", value: (row: ParentWalletActivity) => row.studentName }] : []),
    { label: "Date", value: (row) => row.date },
    { label: "Description", value: (row) => row.description },
    { label: "Channel", value: (row) => row.channel },
    { label: "Amount", value: (row) => row.amount },
    { label: "Balance after", value: (row) => row.balanceAfter },
    { label: "Status", value: (row) => row.status },
  ];
  const exportOptions = {
    filters: [
      { label: "Search", value: query.trim() || "All activity" },
      { label: "Status", value: status === "all" ? "All" : status },
      { label: "Channel", value: channel === "all" ? "All" : channel },
    ],
    summary: [
      { label: "Transactions", value: filteredRows.length },
      { label: "Net activity", value: formatMoney(filteredRows.reduce((total, row) => total + parseMoney(row.amount), 0)) },
    ],
  };

  return (
    <>
      {!compactPreview ? <div className="border-b border-border px-4 py-3 sm:px-5">
        <DashboardTableControls
          tone="parent"
          layout="compact"
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search wallet activity…"
          searchLabel="Search wallet activity by student, description, channel, amount, or status"
          activeFilterCount={Number(status !== "all") + Number(channel !== "all")}
          filterTitle="Filter wallet activity"
          filterDescription="Narrow transactions by status or channel."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Channel", value: channel, onChange: setChannel, options: toFilterOptions(rows.map((row) => row.channel), "All channels") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setChannel("all");
          }}
          clearLabel="Reset filters"
          clearDisabled={query.trim().length === 0 && status === "all" && channel === "all"}
          onExport={() => exportRowsToExcel(excelFilename, exportTitle, filteredRows, exportColumns, {
            worksheetName,
            ...exportOptions,
          })}
          onExportPdf={() => exportRowsToPdf(pdfFilename, exportTitle, filteredRows, exportColumns, exportOptions)}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredRows.length === 0}
        />
      </div> : null}
      <ParentTable headers={headers}>
        {(compactPreview ? rows : filteredRows).length > 0 ? (
          (compactPreview ? rows : pagination.pageRows).map((activity) => (
            <tr key={activity.id}>
              <td className="text-[12px] text-muted-foreground">{activity.date}</td>
              {showStudent ? <td className="font-medium">{activity.studentName}</td> : null}
              <td className="font-medium text-foreground">{activity.description}</td>
              <td className="text-muted-foreground">{activity.channel}</td>
              <td className={activity.amount.startsWith("+") ? "font-semibold text-status-success-foreground" : "font-semibold text-status-danger-foreground"}>
                {activity.amount}
              </td>
              <td className="font-semibold">{activity.balanceAfter}</td>
              <td><StatusPill tone={activity.tone}>{activity.status}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={showStudent ? 7 : 6} className="text-center text-muted-foreground">
              {rows.length === 0 ? "No wallet activity yet." : "No wallet activity matches the current filters."}
            </td>
          </tr>
        )}
      </ParentTable>
      {!compactPreview ? <DashboardTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        tone="parent"
      /> : null}
    </>
  );
}

function parseMoney(value: string) {
  const parsed = Number(value.replaceAll(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return `P${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
