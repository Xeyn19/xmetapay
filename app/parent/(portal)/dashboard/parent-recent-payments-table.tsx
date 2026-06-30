"use client";

import { useMemo, useState } from "react";

import { DashboardTableControls, exportRowsToCsv, exportRowsToPdf, filterByQuery, toFilterOptions } from "@/app/_components/table-controls";
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
          onExport={() => exportRowsToCsv("parent-recent-payments.csv", filteredRows, [
            { label: "Reference", value: (row) => row.referenceNumber },
            { label: "Student", value: (row) => row.studentName },
            { label: "Description", value: (row) => row.description },
            { label: "Amount", value: (row) => row.amount },
            { label: "Status", value: (row) => row.status },
          ])}
          onExportPdf={() => exportRowsToPdf("parent-recent-payments.pdf", "Recent payments", filteredRows, [
            { label: "Reference", value: (row) => row.referenceNumber },
            { label: "Student", value: (row) => row.studentName },
            { label: "Description", value: (row) => row.description },
            { label: "Amount", value: (row) => row.amount },
            { label: "Status", value: (row) => row.status },
          ])}
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
          filteredRows.map((payment) => (
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
    </>
  );
}
