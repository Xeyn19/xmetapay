"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Fragment, useMemo, useState } from "react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
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
  const pagination = usePaginatedRows(filteredRows, `${query}|${category}|${status}`);

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
          onExportPdf={() => exportParentFeeSummaryPdf(filteredRows)}
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
          pagination.pageRows.map((row) => (
            <Fragment key={row.id}>
              <tr>
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
            {row.terms.length > 0 ? (
              <tr className="bg-[#fffaf7]">
                <td colSpan={7} className="px-4 py-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#9a3412]">
                    Tuition payment terms
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {row.terms.map((term) => (
                      <div key={term.id} className="rounded-lg border border-[#fed7aa] bg-white px-3 py-2 text-[12px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#1a1a1a]">{term.name}</span>
                          <StatusPill tone={term.tone}>{term.status}</StatusPill>
                        </div>
                        <div className="mt-1 text-[#6b6b6b]">Due {term.dueDate}</div>
                        <div className="mt-1 flex justify-between gap-2">
                          <span>{term.amountPaid} paid</span>
                          <span className="font-semibold text-[#c62828]">{term.balance} balance</span>
                        </div>
                        {!term.payable && term.status !== "Paid" ? (
                          <div className="mt-1 text-[11px] text-[#6b6b6b]">Visible now, not payable for this status.</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ) : null}
            </Fragment>
          ))
        ) : (
          <tr>
            <td colSpan={7} className="text-center text-[#6b6b6b]">
              {rows.length === 0 ? "No assigned fees yet." : "No fee records match the current filters."}
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

function exportParentFeeSummaryPdf(rows: ParentFeeRow[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const columns = ["Student", "Reference", "Fee", "Category", "Billed", "Paid", "Balance", "Due date", "Status"];
  const body = rows.length > 0
    ? rows.flatMap((row) => [
        [
          row.studentName,
          row.studentReference,
          row.feeName,
          row.category === "tuition" ? "Tuition" : "Other fee",
          row.amountDue,
          row.amountPaid,
          row.balance,
          row.dueDate,
          row.status,
        ],
        ...row.terms.map((term) => [
          "",
          "",
          `Term: ${term.name}`,
          "Tuition term",
          term.amountDue,
          term.amountPaid,
          term.balance,
          term.dueDate,
          term.status,
        ]),
      ])
    : [[
        "No records yet",
        ...Array.from({ length: columns.length - 1 }, () => ""),
      ]];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("XMETA Pay", 14, 16);
  doc.setFontSize(12);
  doc.text("Fee summary", 14, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${generatedAt}`, 14, 30);

  autoTable(doc, {
    head: [columns],
    body,
    margin: { left: 14, right: 14 },
    startY: 36,
    styles: {
      cellPadding: 2,
      fontSize: 7,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [230, 74, 25],
      textColor: [255, 255, 255],
    },
    didParseCell: (data) => {
      const row = data.row.raw;

      if (Array.isArray(row) && row[2]?.toString().startsWith("Term:")) {
        data.cell.styles.fillColor = [255, 250, 247];
        data.cell.styles.textColor = [90, 96, 112];

        if (data.column.index === 2) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [154, 52, 18];
        }
      }
    },
  });

  doc.save("parent-fee-summary.pdf");
}
