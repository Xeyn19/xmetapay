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
import { updateOtherFeeTypeStatusAction } from "@/app/admin/fees/other-fee-actions";

export type OtherFeeRow = {
  id: number;
  code: string;
  name: string;
  meta: string;
  purposeGroup: string;
  audience: string;
  policy: string;
  billingBasis: string;
  amountMode: string;
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
  const [purpose, setPurpose] = useState("all");
  const [audience, setAudience] = useState("all");
  const [policy, setPolicy] = useState("all");
  const filteredItems = useMemo(
    () => filterByQuery(
      items.filter((item) => (status === "all" || item.status === status) && (purpose === "all" || item.purposeGroup === purpose) && (audience === "all" || item.audience === audience) && (policy === "all" || item.policy === policy)),
      query,
      (item) => [item.name, item.code, item.meta].join(" "),
    ),
    [audience, items, policy, purpose, query, status],
  );
  const pagination = usePaginatedRows(filteredItems, `${query}|${status}|${purpose}|${audience}|${policy}`);
  const activeFilterCount = [status, purpose, audience, policy].filter((item) => item !== "all").length;
  const hasActiveFilters = query.trim() !== "" || activeFilterCount > 0;
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setPurpose("all");
    setAudience("all");
    setPolicy("all");
  };
  const exportColumns: ExportColumn<OtherFeeRow>[] = [
    { label: "Fee type", value: (item) => item.name },
    { label: "Code", value: (item) => item.code },
    { label: "Description", value: (item) => item.meta },
    { label: "Purpose", value: (item) => item.purposeGroup },
    { label: "Audience", value: (item) => item.audience },
    { label: "Collection policy", value: (item) => item.policy },
    { label: "Billing basis", value: (item) => item.billingBasis },
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
      { label: "Purpose", value: filterLabel(purpose) },
      { label: "Audience", value: filterLabel(audience) },
      { label: "Policy", value: filterLabel(policy) },
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
          searchPlaceholder="Search fee name, code, or description..."
          searchLabel="Search other fees by fee name, code, or description"
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(items.map((item) => item.status), "All statuses") },
            { label: "Purpose", value: purpose, onChange: setPurpose, options: toFilterOptions(items.map((item) => item.purposeGroup), "All purposes") },
            { label: "Audience", value: audience, onChange: setAudience, options: toFilterOptions(items.map((item) => item.audience), "All audiences") },
            { label: "Collection policy", value: policy, onChange: setPolicy, options: toFilterOptions(items.map((item) => item.policy), "All policies") },
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
          layout="compact"
          activeFilterCount={activeFilterCount}
          filterTitle="Filter fee types"
          filterDescription="Narrow the catalog by purpose, audience, policy, or status."
        />
        {hasActiveFilters ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-live="polite"><span><strong className="text-foreground">{filteredItems.length}</strong> matching fee types</span><span><strong className="text-foreground">{money(filteredTotals.assigned)}</strong> assigned</span><span><strong className="text-status-success-foreground">{money(filteredTotals.collected)}</strong> collected</span><span><strong className="text-status-danger-foreground">{money(filteredTotals.outstanding)}</strong> outstanding</span></div> : null}
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
              <div key={item.id} className="grid gap-3 px-[18px] py-3 transition hover:bg-muted/70 md:grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_minmax(150px,.8fr)_auto] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-button-soft text-primary">
                    <ClipboardList className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-foreground">{item.name} <span className="font-mono text-[10px] font-semibold text-muted-foreground">{item.code}</span></div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.meta}</div>
                  </div>
                </div>
                <div className="text-xs"><div className="font-bold text-foreground">{item.purposeGroup}</div><div className="mt-0.5 text-muted-foreground">{item.audience}</div></div>
                <div className="text-xs"><div className="font-bold text-foreground">{item.policy}</div><div className="mt-0.5 text-muted-foreground">{item.billingBasis}</div></div>
                <div className="flex flex-wrap items-center gap-3 text-left md:justify-end md:text-right sm:gap-5">
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
                    <form action={updateOtherFeeTypeStatusAction.bind(null, item.id, item.status === "Active" ? "inactive" : "active")}>
                      <button type="submit" className="min-h-11 rounded-lg px-2 text-xs font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {item.status === "Active" ? "Make inactive" : "Make active"}
                      </button>
                    </form>
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
