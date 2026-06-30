"use client";

import { useMemo, useState } from "react";

import { DashboardTableControls, exportRowsToCsv, exportRowsToPdf, filterByQuery, toFilterOptions } from "@/app/_components/table-controls";

import { AdminTable, StatusPill } from "../../_components/admin-ui";

export type TuitionReportRow = {
  student: string;
  grade: string;
  section: string;
  due: number;
  paid: number;
  balance: number;
  lastPayment: string;
  status: "paid" | "partial" | "unpaid";
};

export function TuitionReportTable({ rows }: { rows: TuitionReportRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [grade, setGrade] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => (status === "all" || row.status === status) && (grade === "all" || row.grade === grade)),
      query,
      (row) => `${row.student} ${row.grade} ${row.section} ${row.lastPayment} ${row.status}`,
    ),
    [grade, query, rows, status],
  );

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search student, grade..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Grade", value: grade, onChange: setGrade, options: toFilterOptions(rows.map((row) => row.grade), "All grades") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setGrade("all");
          }}
          onExport={() => exportRowsToCsv("admin-tuition-report.csv", filteredRows, [
            { label: "Student name", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Section", value: (row) => row.section },
            { label: "Fee due", value: (row) => row.due },
            { label: "Paid", value: (row) => row.paid },
            { label: "Balance", value: (row) => row.balance },
            { label: "Last payment", value: (row) => row.lastPayment },
            { label: "Status", value: (row) => row.status },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-tuition-report.pdf", "Tuition report", filteredRows, [
            { label: "Student name", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Section", value: (row) => row.section },
            { label: "Fee due", value: (row) => row.due },
            { label: "Paid", value: (row) => row.paid },
            { label: "Balance", value: (row) => row.balance },
            { label: "Last payment", value: (row) => row.lastPayment },
            { label: "Status", value: (row) => row.status },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <AdminTable
        headers={[
          { label: "Student name", className: "w-[20%]" },
          { label: "Grade", className: "w-[10%]" },
          { label: "Section", className: "w-[10%]" },
          { label: "Fee due", className: "w-[12%]" },
          { label: "Paid", className: "w-[11%]" },
          { label: "Balance", className: "w-[11%]" },
          { label: "Last payment", className: "w-[13%]" },
          { label: "Status", className: "w-[13%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          filteredRows.map((row) => {
            const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);

            return (
              <tr key={`${row.student}-${row.grade}`}>
                <td className="font-bold">{row.student}</td>
                <td>{row.grade}</td>
                <td>{row.section}</td>
                <td>P{row.due.toLocaleString()}</td>
                <td className="font-semibold text-[#2e7d32]">P{row.paid.toLocaleString()}</td>
                <td className={row.balance > 0 ? "font-semibold text-[#c62828]" : "text-[#9ba3b8]"}>
                  P{row.balance.toLocaleString()}
                </td>
                <td className="font-mono text-[11px] text-[#5a6070]">{row.lastPayment}</td>
                <td>
                  <StatusPill tone={row.status}>{statusLabel}</StatusPill>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={8} className="text-center text-[#5a6070]">
              {rows.length === 0 ? "No tuition fee assignments yet." : "No tuition rows match the current filters."}
            </td>
          </tr>
        )}
      </AdminTable>
    </>
  );
}
