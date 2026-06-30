"use client";

import { useMemo, useState } from "react";

import { DashboardTableControls, exportRowsToCsv, exportRowsToPdf, filterByQuery, toFilterOptions } from "@/app/_components/table-controls";
import type { ParentWalletActivity } from "@/lib/students/records";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

export function ParentWalletActivityTable({
  rows,
  csvFilename = "parent-wallet-activity.csv",
  pdfFilename = "parent-wallet-activity.pdf",
  exportTitle = "Wallet activity",
  showStudent = true,
}: {
  rows: ParentWalletActivity[];
  csvFilename?: string;
  pdfFilename?: string;
  exportTitle?: string;
  showStudent?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => (
        (status === "all" || row.status === status) &&
        (channel === "all" || row.channel === channel)
      )),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [channel, query, rows, status],
  );
  const headers = showStudent
    ? [
      { label: "Date", className: "w-[14%]" },
      { label: "Student", className: "w-[16%]" },
      { label: "Description", className: "w-[22%]" },
      { label: "Channel", className: "w-[14%]" },
      { label: "Amount", className: "w-[10%]" },
      { label: "Balance", className: "w-[12%]" },
      { label: "Status", className: "w-[12%]" },
    ]
    : [
      { label: "Date", className: "w-[16%]" },
      { label: "Description", className: "w-[28%]" },
      { label: "Channel", className: "w-[16%]" },
      { label: "Amount", className: "w-[12%]" },
      { label: "Balance", className: "w-[14%]" },
      { label: "Status", className: "w-[14%]" },
    ];

  return (
    <>
      <div className="border-b border-black/[0.08] px-4 py-3 sm:px-5">
        <DashboardTableControls
          tone="parent"
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search wallet activity..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Channel", value: channel, onChange: setChannel, options: toFilterOptions(rows.map((row) => row.channel), "All channels") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setChannel("all");
          }}
          onExport={() => exportRowsToCsv(csvFilename, filteredRows, [
            ...(showStudent ? [{ label: "Student", value: (row: ParentWalletActivity) => row.studentName }] : []),
            { label: "Date", value: (row) => row.date },
            { label: "Description", value: (row) => row.description },
            { label: "Channel", value: (row) => row.channel },
            { label: "Amount", value: (row) => row.amount },
            { label: "Balance after", value: (row) => row.balanceAfter },
            { label: "Status", value: (row) => row.status },
          ])}
          onExportPdf={() => exportRowsToPdf(pdfFilename, exportTitle, filteredRows, [
            ...(showStudent ? [{ label: "Student", value: (row: ParentWalletActivity) => row.studentName }] : []),
            { label: "Date", value: (row) => row.date },
            { label: "Description", value: (row) => row.description },
            { label: "Channel", value: (row) => row.channel },
            { label: "Amount", value: (row) => row.amount },
            { label: "Balance after", value: (row) => row.balanceAfter },
            { label: "Status", value: (row) => row.status },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <ParentTable headers={headers}>
        {filteredRows.length > 0 ? (
          filteredRows.map((activity) => (
            <tr key={activity.id}>
              <td className="text-[12px] text-[#6b6b6b]">{activity.date}</td>
              {showStudent ? <td className="font-medium">{activity.studentName}</td> : null}
              <td className="font-medium text-[#1a1a1a]">{activity.description}</td>
              <td className="text-[#6b6b6b]">{activity.channel}</td>
              <td className={activity.amount.startsWith("+") ? "font-semibold text-[#2e7d32]" : "font-semibold text-[#c62828]"}>
                {activity.amount}
              </td>
              <td className="font-semibold">{activity.balanceAfter}</td>
              <td><StatusPill tone={activity.tone}>{activity.status}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={showStudent ? 7 : 6} className="text-center text-[#6b6b6b]">
              {rows.length === 0 ? "No wallet activity yet." : "No wallet activity matches the current filters."}
            </td>
          </tr>
        )}
      </ParentTable>
    </>
  );
}
