"use client";

import { useMemo, useState } from "react";

import { DashboardTableControls, exportRowsToCsv, exportRowsToPdf, filterByQuery, toFilterOptions } from "@/app/_components/table-controls";

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

export function StoreTransactionsTable({ rows }: { rows: StoreTransactionRow[] }) {
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
          onExport={() => exportRowsToCsv("admin-store-transactions.csv", filteredRows, [
            { label: "Ref #", value: (row) => row.ref },
            { label: "Student", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Store", value: (row) => row.merchant },
            { label: "Amount", value: (row) => row.amount },
            { label: "Txn fee", value: (row) => row.fee },
            { label: "Time", value: (row) => row.time },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-store-transactions.pdf", "Store transactions", filteredRows, [
            { label: "Ref #", value: (row) => row.ref },
            { label: "Student", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Store", value: (row) => row.merchant },
            { label: "Amount", value: (row) => row.amount },
            { label: "Txn fee", value: (row) => row.fee },
            { label: "Time", value: (row) => row.time },
          ])}
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
          filteredRows.map((row) => (
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
    </>
  );
}
