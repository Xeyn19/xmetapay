"use client";

import { useMemo, useState } from "react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";

import { AdminTable, StatusPill } from "../../_components/admin-ui";

export type AllowanceRow = {
  student: string;
  grade: string;
  balance: string;
  lastTopUp: string;
  monthSpend: string;
  totalTopUps: string;
  status: "Active" | "Low" | "No balance";
};

export function AllowanceTable({ rows }: { rows: AllowanceRow[] }) {
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

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search wallets..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
          }}
          onExport={() => exportRowsToCsv("admin-allowance-wallets.csv", filteredRows, [
            { label: "Student", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Current balance", value: (row) => row.balance },
            { label: "Last top-up", value: (row) => row.lastTopUp },
            { label: "Month spend", value: (row) => row.monthSpend },
            { label: "Total top-ups", value: (row) => row.totalTopUps },
            { label: "Status", value: (row) => row.status },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-allowance-wallets.pdf", "Allowance wallets", filteredRows, [
            { label: "Student", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Current balance", value: (row) => row.balance },
            { label: "Last top-up", value: (row) => row.lastTopUp },
            { label: "Month spend", value: (row) => row.monthSpend },
            { label: "Total top-ups", value: (row) => row.totalTopUps },
            { label: "Status", value: (row) => row.status },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <AdminTable
        headers={[
          { label: "Student", className: "w-[22%]" },
          { label: "Grade", className: "w-[11%]" },
          { label: "Current balance", className: "w-[16%]" },
          { label: "Last top-up", className: "w-[14%]" },
          { label: "Month spend", className: "w-[13%]" },
          { label: "Total top-ups", className: "w-[14%]" },
          { label: "Status", className: "w-[10%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={row.student}>
              <td className="font-bold">{row.student}</td>
              <td>{row.grade}</td>
              <td className={row.status === "No balance" ? "font-bold text-[#9ba3b8]" : row.status === "Low" ? "font-bold text-[#f57c00]" : "font-bold text-[#e64a19]"}>
                {row.balance}
              </td>
              <td>{row.lastTopUp}</td>
              <td>{row.monthSpend}</td>
              <td>{row.totalTopUps}</td>
              <td><StatusPill tone={row.status === "Low" ? "low" : row.status === "No balance" ? "inactive" : "active"}>{row.status}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7} className="text-center text-[#5a6070]">
              {rows.length === 0 ? "No wallet records yet." : "No wallet records match the current filters."}
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
    </>
  );
}
