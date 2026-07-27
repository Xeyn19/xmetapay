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

import { AdminTable } from "../../_components/admin-ui";

export type StoreTransactionRow = {
  ref: string;
  student: string;
  grade: string;
  merchant: string;
  amount: string;
  fee: string;
  time: string;
};

export function StoreTransactionsTable({ rows, schoolName, schoolYearName }: { rows: StoreTransactionRow[]; schoolName: string; schoolYearName: string }) {
  const [query, setQuery] = useState("");
  const [merchant, setMerchant] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => merchant === "all" || row.merchant === merchant),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [merchant, query, rows],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${merchant}`);
  const exportColumns: ExportColumn<StoreTransactionRow>[] = [
    { label: "Ref #", value: (row) => row.ref },
    { label: "Student", value: (row) => row.student },
    { label: "Grade", value: (row) => row.grade },
    { label: "Store", value: (row) => row.merchant },
    { label: "Amount", value: (row) => row.amount },
    { label: "Txn fee", value: (row) => row.fee },
    { label: "Time", value: (row) => row.time },
  ];
  const exportOptions = {
    context: [{ label: "School", value: schoolName }, { label: "School year", value: schoolYearName }],
    filters: [
      { label: "Search", value: query.trim() || "All transactions" },
      { label: "Merchant", value: filterLabel(merchant) },
    ],
    summary: [
      { label: "Transactions", value: filteredRows.length },
      { label: "Amount", value: money(filteredRows.reduce((total, row) => total + parseMoney(row.amount), 0)) },
      { label: "Transaction fees", value: money(filteredRows.reduce((total, row) => total + parseMoney(row.fee), 0)) },
    ],
  };

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search store transactions..."
          filters={[
            { label: "Merchant", value: merchant, onChange: setMerchant, options: toFilterOptions(rows.map((row) => row.merchant), "All merchants") },
          ]}
          onClear={() => {
            setQuery("");
            setMerchant("all");
          }}
          onExport={() => exportRowsToExcel("admin-store-transactions.xlsx", "Store transactions", filteredRows, exportColumns, { worksheetName: "Store transactions", ...exportOptions })}
          onExportPdf={() => exportRowsToPdf("admin-store-transactions.pdf", "Store transactions", filteredRows, exportColumns, exportOptions)}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <AdminTable
        headers={[
          { label: "Ref #", className: "w-[10%]" },
          { label: "Student", className: "w-[20%]" },
          { label: "Grade", className: "w-[10%]" },
          { label: "Store", className: "w-[16%]" },
          { label: "Amount", className: "w-[14%]" },
          { label: "Txn fee", className: "w-[12%]" },
          { label: "Time", className: "w-[18%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={row.ref}>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.ref}</td>
              <td className="font-bold">{row.student}</td>
              <td>{row.grade}</td>
              <td>{row.merchant}</td>
              <td className="font-bold">{row.amount}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.fee}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.time}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7} className="text-center text-[#5a6070]">
              {rows.length === 0 ? "No store transactions yet." : "No store transactions match the current filters."}
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
