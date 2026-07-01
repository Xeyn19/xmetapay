"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";

import { StatusPill } from "../../_components/admin-ui";

export type OtherFeeRow = {
  name: string;
  desc: string;
  amount: string;
  status: string;
  collected: string;
};

export function OtherFeesTable({ items }: { items: OtherFeeRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredItems = useMemo(
    () => filterByQuery(
      items.filter((item) => status === "all" || item.status === status),
      query,
      (item) => Object.values(item).join(" "),
    ),
    [items, query, status],
  );
  const pagination = usePaginatedRows(filteredItems, `${query}|${status}`);

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search fee types..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(items.map((item) => item.status), "All statuses") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
          }}
          onExport={() => exportRowsToCsv("admin-other-fees.csv", filteredItems, [
            { label: "Fee type", value: (item) => item.name },
            { label: "Description", value: (item) => item.desc },
            { label: "Default amount", value: (item) => item.amount },
            { label: "Collected", value: (item) => item.collected },
            { label: "Status", value: (item) => item.status },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-other-fees.pdf", "Other fees", filteredItems, [
            { label: "Fee type", value: (item) => item.name },
            { label: "Description", value: (item) => item.desc },
            { label: "Default amount", value: (item) => item.amount },
            { label: "Collected", value: (item) => item.collected },
            { label: "Status", value: (item) => item.status },
          ])}
          exportDisabled={filteredItems.length === 0}
        />
      </div>
      <div className="divide-y divide-black/[0.07]">
        {filteredItems.length > 0 ? (
          pagination.pageRows.map((item) => (
            <div key={item.name} className="flex flex-wrap items-center justify-between gap-4 px-[18px] py-3 transition hover:bg-[#f7f8fa]">
              <div className="flex items-center gap-2.5">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-[#fbe9e7] text-[#e64a19]">
                  <ClipboardList className="size-4" />
                </span>
                <div>
                  <div className="text-[13px] font-bold text-[#0f1117]">{item.name}</div>
                  <div className="mt-0.5 text-[11px] text-[#5a6070]">{item.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-5 text-right">
                <div>
                  <div className="text-sm font-bold">{item.amount}</div>
                  <div className="text-[11px] text-[#5a6070]">Collected {item.collected}</div>
                </div>
                <StatusPill tone="active">{item.status}</StatusPill>
              </div>
            </div>
          ))
        ) : (
          <div className="px-[18px] py-8 text-center text-[12.5px] text-[#5a6070]">
            {items.length === 0 ? "No other fee types yet." : "No other fee types match the current filters."}
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
