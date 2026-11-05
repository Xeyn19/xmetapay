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

import { AdminTable, DashboardCard } from "../../_components/admin-ui";
import { History } from "lucide-react";

export type RecentPaymentRow = {
  time: string;
  student: string;
  type: string;
  amount: string;
  channel: string;
  status: string;
};

export function RecentPaymentsTable({ rows, schoolName, schoolYearName }: { rows: RecentPaymentRow[]; schoolName: string; schoolYearName: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => (status === "all" || row.status === status) && (channel === "all" || row.channel === channel)),
      query,
      (row) => [row.student, row.type, row.channel, row.status].join(" "),
    ),
    [channel, query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}|${channel}`);
  const hasActiveFilters = query.trim() !== "" || status !== "all" || channel !== "all";
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setChannel("all");
  };
  const exportColumns: ExportColumn<RecentPaymentRow>[] = [
    { label: "Time", value: (row) => row.time },
    { label: "Student", value: (row) => row.student },
    { label: "Type", value: (row) => row.type },
    { label: "Amount", value: (row) => row.amount },
    { label: "Channel", value: (row) => row.channel },
    { label: "Status", value: (row) => row.status },
  ];
  const exportOptions = {
    context: [{ label: "School", value: schoolName }, { label: "School year", value: schoolYearName }],
    filters: [
      { label: "Search", value: query.trim() || "All payments" },
      { label: "Status", value: filterLabel(status) },
      { label: "Channel", value: filterLabel(channel) },
    ],
    summary: [
      { label: "Payments", value: filteredRows.length },
      { label: "Total amount", value: money(filteredRows.reduce((total, row) => total + parseMoney(row.amount), 0)) },
    ],
  };

  return (
    <DashboardCard title="Recent payment activity" icon={History} bodyClassName="p-0">
      <div className="border-b border-border px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search student, type, channel, or status..."
          searchLabel="Search recent payments by student, type, channel, or status"
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Channel", value: channel, onChange: setChannel, options: toFilterOptions(rows.map((row) => row.channel), "All channels") },
          ]}
          onClear={resetFilters}
          clearLabel="Reset filters"
          clearDisabled={!hasActiveFilters}
          onExport={() => exportRowsToExcel("admin-recent-payments.xlsx", "Recent payment activity", filteredRows, exportColumns, { worksheetName: "Recent payments", ...exportOptions })}
          onExportPdf={() => exportRowsToPdf("admin-recent-payments.pdf", "Recent payment activity", filteredRows, exportColumns, exportOptions)}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredRows.length === 0}
        />
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite"><strong className="text-foreground">{filteredRows.length}</strong> payments · <strong className="text-foreground">{money(filteredRows.reduce((total, row) => total + parseMoney(row.amount), 0))}</strong> total</p>
      </div>
      <AdminTable
        headers={[
          { label: "Time", className: "w-[18%]" },
          { label: "Student", className: "w-[22%]" },
          { label: "Type", className: "w-[18%]" },
          { label: "Amount", className: "w-[14%]" },
          { label: "Channel", className: "w-[18%]" },
          { label: "Status", className: "w-[10%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={`${row.time}-${row.student}-${row.amount}`}>
              <td className="font-mono text-[11px] text-muted-foreground">{row.time}</td>
              <td className="font-bold">{row.student}</td>
              <td>{row.type}</td>
              <td className="font-bold text-primary">{row.amount}</td>
              <td>{row.channel}</td>
              <td className="font-semibold text-status-success-foreground">{row.status}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              {rows.length === 0 ? "No payment records yet." : <span>No payment records match the current filters. <button type="button" onClick={resetFilters} className="ml-1 min-h-11 font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reset filters</button></span>}
            </td>
          </tr>
        )}
      </AdminTable>
      <DashboardTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </DashboardCard>
  );
}

function filterLabel(value: string) {
  return value === "all" ? "All" : value;
}

function parseMoney(value: string) {
  const parsed = Number(value.replaceAll(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return `P${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
