"use client";

import { useMemo, useState } from "react";

import { DashboardTableControls, exportRowsToCsv, filterByQuery, toFilterOptions } from "@/app/_components/table-controls";

import { AdminTable, StatusPill } from "../../_components/admin-ui";

export type CollectionRow = {
  ref: string;
  student: string;
  grade: string;
  fee: string;
  amount: string;
  date: string;
  channel: string;
  status: string;
};

export function CollectionsTable({ rows }: { rows: CollectionRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const filteredRows = useMemo(() => {
    return filterByQuery(
      rows.filter((row) => (status === "all" || row.status === status) && (channel === "all" || row.channel === channel)),
      query,
      (row) => Object.values(row).join(" "),
    );
  }, [channel, query, rows, status]);

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search student, ref..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Channel", value: channel, onChange: setChannel, options: toFilterOptions(rows.map((row) => row.channel), "All channels") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setChannel("all");
          }}
          onExport={() => exportRowsToCsv("admin-collections.csv", filteredRows, [
            { label: "Reference", value: (row) => row.ref },
            { label: "Student", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Fee type", value: (row) => row.fee },
            { label: "Amount", value: (row) => row.amount },
            { label: "Date and time", value: (row) => row.date },
            { label: "Channel", value: (row) => row.channel },
            { label: "Status", value: (row) => row.status },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <AdminTable
        headers={[
          { label: "Ref #", className: "w-[9%]" },
          { label: "Student", className: "w-[18%]" },
          { label: "Grade", className: "w-[10%]" },
          { label: "Fee type", className: "w-[17%]" },
          { label: "Amount", className: "w-[11%]" },
          { label: "Date & time", className: "w-[16%]" },
          { label: "Channel", className: "w-[11%]" },
          { label: "Status", className: "w-[8%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          filteredRows.map((row) => (
            <tr key={row.ref}>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.ref}</td>
              <td className="font-bold">{row.student}</td>
              <td>{row.grade}</td>
              <td>{row.fee}</td>
              <td className="font-bold text-[#e64a19]">{row.amount}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.date}</td>
              <td>{row.channel}</td>
              <td><StatusPill tone={row.status === "Partial" ? "partial" : row.status === "Paid" || row.status === "Done" ? "paid" : "pending"}>{row.status}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8} className="text-center text-[#5a6070]">
              {rows.length === 0 ? "No payment records yet." : "No payment records match the current filters."}
            </td>
          </tr>
        )}
      </AdminTable>
    </>
  );
}
