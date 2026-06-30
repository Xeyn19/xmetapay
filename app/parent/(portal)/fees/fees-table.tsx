"use client";

import { useMemo, useState } from "react";

import { DashboardTableControls, exportRowsToCsv, exportRowsToPdf, filterByQuery, toFilterOptions } from "@/app/_components/table-controls";
import type { ParentFeeRow } from "@/lib/fees/records";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

export function ParentFeesTable({ rows }: { rows: ParentFeeRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) =>
        (category === "all" || row.category === category)
        && (status === "all" || row.status === status)
      ),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [category, query, rows, status],
  );

  return (
    <>
      <div className="border-b border-black/[0.08] px-4 py-3 sm:px-5">
        <DashboardTableControls
          tone="parent"
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search fees..."
          filters={[
            { label: "Category", value: category, onChange: setCategory, options: toFilterOptions(rows.map((row) => row.category), "All categories") },
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
          ]}
          onClear={() => {
            setQuery("");
            setCategory("all");
            setStatus("all");
          }}
          onExport={() => exportRowsToCsv("parent-fee-summary.csv", filteredRows, [
            { label: "Student", value: (row) => row.studentName },
            { label: "Reference", value: (row) => row.studentReference },
            { label: "Fee", value: (row) => row.feeName },
            { label: "Category", value: (row) => row.category },
            { label: "Billed", value: (row) => row.amountDue },
            { label: "Paid", value: (row) => row.amountPaid },
            { label: "Balance", value: (row) => row.balance },
            { label: "Due date", value: (row) => row.dueDate },
            { label: "Status", value: (row) => row.status },
          ])}
          onExportPdf={() => exportRowsToPdf("parent-fee-summary.pdf", "Fee summary", filteredRows, [
            { label: "Student", value: (row) => row.studentName },
            { label: "Reference", value: (row) => row.studentReference },
            { label: "Fee", value: (row) => row.feeName },
            { label: "Category", value: (row) => row.category },
            { label: "Billed", value: (row) => row.amountDue },
            { label: "Paid", value: (row) => row.amountPaid },
            { label: "Balance", value: (row) => row.balance },
            { label: "Due date", value: (row) => row.dueDate },
            { label: "Status", value: (row) => row.status },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <ParentTable
        headers={[
          { label: "Student", className: "w-[18%]" },
          { label: "Fee", className: "w-[18%]" },
          { label: "Billed", className: "w-[12%]" },
          { label: "Paid", className: "w-[12%]" },
          { label: "Balance", className: "w-[12%]" },
          { label: "Due date", className: "w-[16%]" },
          { label: "Status", className: "w-[12%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          filteredRows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="font-semibold text-[#1a1a1a]">{row.studentName}</div>
                <div className="font-mono text-[11px] text-[#6b6b6b]">{row.studentReference}</div>
              </td>
              <td>
                <div className="font-semibold text-[#1a1a1a]">{row.feeName}</div>
                <div className="text-[11px] text-[#6b6b6b]">{row.category === "tuition" ? "Tuition" : "Other fee"}</div>
              </td>
              <td>{row.amountDue}</td>
              <td className="font-semibold text-[#2e7d32]">{row.amountPaid}</td>
              <td className="font-semibold text-[#c62828]">{row.balance}</td>
              <td>{row.dueDate}</td>
              <td><StatusPill tone={row.tone}>{row.status}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7} className="text-center text-[#6b6b6b]">
              {rows.length === 0 ? "No assigned fees yet." : "No fee records match the current filters."}
            </td>
          </tr>
        )}
      </ParentTable>
    </>
  );
}
