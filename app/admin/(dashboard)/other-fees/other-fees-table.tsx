"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

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

import { StatusPill } from "../../_components/admin-ui";

export type OtherFeeRow = {
  name: string;
  meta: string;
  amount: string;
  status: string;
  assignedCount: number;
  paidCount: number;
  paidLabel: string;
  totalBilled: string;
  collected: string;
  outstanding: string;
};

export function OtherFeesTable({
  items,
  schoolName,
  schoolYearName,
}: {
  items: OtherFeeRow[];
  schoolName: string;
  schoolYearName: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredItems = useMemo(
    () => filterByQuery(
      items.filter((item) => status === "all" || item.status === status),
      query,
      (item) => [item.name, item.meta].join(" "),
    ),
    [items, query, status],
  );
  const pagination = usePaginatedRows(filteredItems, `${query}|${status}`);
  const hasActiveFilters = query.trim() !== "" || status !== "all";
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
  };
  const exportColumns: ExportColumn<OtherFeeRow>[] = [
    { label: "Fee type", value: (item) => item.name },
    { label: "Description", value: (item) => item.meta },
    { label: "Default amount", value: (item) => item.amount },
    { label: "Assigned total", value: (item) => item.totalBilled },
    { label: "Collected", value: (item) => item.collected },
    { label: "Outstanding", value: (item) => item.outstanding },
    { label: "Paid count", value: (item) => item.paidLabel },
    { label: "Status", value: (item) => item.status },
  ];
  const filteredTotals = filteredItems.reduce(
    (totals, item) => ({
      assigned: totals.assigned + parseMoney(item.totalBilled),
      collected: totals.collected + parseMoney(item.collected),
      outstanding: totals.outstanding + parseMoney(item.outstanding),
    }),
    { assigned: 0, collected: 0, outstanding: 0 },
  );
  const exportOptions = {
    context: [
      { label: "School", value: schoolName },
      { label: "School year", value: schoolYearName },
    ],
    filters: [
      { label: "Search", value: query.trim() || "All fee types" },
      { label: "Status", value: filterLabel(status) },
    ],
    summary: [
      { label: "Fee types", value: filteredItems.length },
      { label: "Assigned total", value: money(filteredTotals.assigned) },
      { label: "Collected", value: money(filteredTotals.collected) },
      { label: "Outstanding", value: money(filteredTotals.outstanding) },
    ],
  };

  return (
    <>
      <div className="border-b border-border px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search fee name or description..."
          searchLabel="Search other fees by fee name or description"
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(items.map((item) => item.status), "All statuses") },
          ]}
          onClear={resetFilters}
          clearLabel="Reset filters"
          clearDisabled={!hasActiveFilters}
          onExport={() => exportRowsToExcel(
            "admin-other-fees.xlsx",
            "Other fees",
            filteredItems,
            exportColumns,
            { worksheetName: "Other fees", ...exportOptions },
          )}
          onExportPdf={() => exportRowsToPdf(
            "admin-other-fees.pdf",
            "Other fees",
            filteredItems,
            exportColumns,
            exportOptions,
          )}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredItems.length === 0}
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-live="polite"><span><strong className="text-foreground">{filteredItems.length}</strong> fee types</span><span><strong className="text-foreground">{money(filteredTotals.assigned)}</strong> assigned</span><span><strong className="text-status-success-foreground">{money(filteredTotals.collected)}</strong> collected</span><span><strong className="text-status-danger-foreground">{money(filteredTotals.outstanding)}</strong> outstanding</span></div>
      </div>
      <div className="divide-y divide-border">
        {filteredItems.length > 0 ? (
          pagination.pageRows.map((item) => {
            const assignmentTone = item.assignedCount === 0
              ? "bg-status-inactive-bg text-status-inactive-foreground"
              : item.paidCount >= item.assignedCount
                ? "bg-status-success-bg text-status-success-foreground"
                : "bg-status-warning-bg text-status-warning-foreground";
            const statusTone = item.status === "Active" ? "active" : "inactive";

            return (
              <div key={item.name} className="flex flex-wrap items-center justify-between gap-4 px-[18px] py-3 transition hover:bg-muted/70">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-button-soft text-primary">
                    <ClipboardList className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-foreground">{item.name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.meta}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 text-right sm:gap-5">
                  <div>
                    <div className="text-sm font-bold">{item.amount}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.assignedCount > 0 ? `Assigned ${item.totalBilled}` : "Not assigned yet"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Collected {item.collected}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold leading-5 ${assignmentTone}`}>
                      {item.paidLabel}
                    </span>
                    <StatusPill tone={statusTone}>{item.status}</StatusPill>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-[18px] py-8 text-center text-[12.5px] text-muted-foreground">
            {items.length === 0 ? "No other fee types yet." : <span>No other fee types match the current filters. <button type="button" onClick={resetFilters} className="ml-1 min-h-11 font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reset filters</button></span>}
          </div>
        )}
      </div>
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
    </>
  );
}

function filterLabel(value: string) {
  if (value === "all") return "All";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseMoney(value: string) {
  const parsed = Number(value.replaceAll(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return `P${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
