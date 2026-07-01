"use client";

import Link from "next/link";
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
import type { ParentPaymentHistoryData } from "@/lib/payments/records";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

type PaymentHistoryRow = ParentPaymentHistoryData["rows"][number];

export function ParentPaymentHistoryTable({ rows }: { rows: PaymentHistoryRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) =>
        (status === "all" || row.status === status)
        && (channel === "all" || row.channel === channel)
      ),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [channel, query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}|${channel}`);

  return (
    <>
      <div className="border-b border-black/[0.08] px-4 py-3 sm:px-5">
        <DashboardTableControls
          tone="parent"
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search transactions..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Channel", value: channel, onChange: setChannel, options: toFilterOptions(rows.map((row) => row.channel), "All channels") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setChannel("all");
          }}
          onExport={() => exportRowsToCsv("parent-payment-history.csv", filteredRows, [
            { label: "Reference", value: (row) => row.referenceNumber },
            { label: "Date", value: (row) => row.paidAt },
            { label: "Student", value: (row) => row.studentName },
            { label: "Description", value: (row) => row.description },
            { label: "Amount", value: (row) => row.amount },
            { label: "Channel", value: (row) => row.channel },
            { label: "Status", value: (row) => row.status },
          ])}
          onExportPdf={() => exportRowsToPdf("parent-payment-history.pdf", "Payment history", filteredRows, [
            { label: "Reference", value: (row) => row.referenceNumber },
            { label: "Date", value: (row) => row.paidAt },
            { label: "Student", value: (row) => row.studentName },
            { label: "Description", value: (row) => row.description },
            { label: "Amount", value: (row) => row.amount },
            { label: "Channel", value: (row) => row.channel },
            { label: "Status", value: (row) => row.status },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <ParentTable
        headers={[
          { label: "Ref #", className: "w-[18%]" },
          { label: "Date", className: "w-[12%]" },
          { label: "Student", className: "w-[18%]" },
          { label: "Description", className: "w-[22%]" },
          { label: "Amount", className: "w-[10%]" },
          { label: "Channel", className: "w-[10%]" },
          { label: "Status", className: "w-[10%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((row) => {
            const refContent = row.receiptId ? (
              <Link href={`/parent/receipt?receiptId=${row.receiptId}`} className="text-[#e64a19] hover:underline">
                {row.referenceNumber}
              </Link>
            ) : (
              row.referenceNumber
            );

            return (
              <tr key={row.referenceNumber}>
                <td className="font-mono text-[11px] text-[#6b6b6b]">{refContent}</td>
                <td>{row.paidAt}</td>
                <td className="font-medium">{row.studentName}</td>
                <td>{row.description}</td>
                <td className="font-semibold">{row.amount}</td>
                <td>{row.channel}</td>
                <td><StatusPill tone={row.status === "Paid" ? "green" : row.status === "Pending" ? "amber" : "red"}>{row.status}</StatusPill></td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={7} className="text-center text-[#6b6b6b]">
              {rows.length === 0 ? "No payment records yet." : "No payment records match the current filters."}
            </td>
          </tr>
        )}
      </ParentTable>
      <DashboardTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        tone="parent"
      />
    </>
  );
}
