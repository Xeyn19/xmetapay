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
import type { AdminParentRow } from "@/lib/students/records";

import { AdminTable, StatusPill } from "../../_components/admin-ui";

export function ParentsTable({ rows }: { rows: AdminParentRow[] }) {
  const [query, setQuery] = useState("");
  const [relationship, setRelationship] = useState("all");
  const [status, setStatus] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) =>
        (relationship === "all" || row.relationship === relationship)
        && (status === "all" || row.status === status)
      ),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [query, relationship, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${relationship}|${status}`);

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search parents..."
          filters={[
            { label: "Relationship", value: relationship, onChange: setRelationship, options: toFilterOptions(rows.map((row) => row.relationship), "All relationships") },
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
          ]}
          onClear={() => {
            setQuery("");
            setRelationship("all");
            setStatus("all");
          }}
          onExport={() => exportRowsToCsv("admin-parent-contacts.csv", filteredRows, [
            { label: "Parent name", value: (row) => row.parentName },
            { label: "Students", value: (row) => row.students },
            { label: "Grade", value: (row) => row.grade },
            { label: "Contact number", value: (row) => row.contact },
            { label: "Email address", value: (row) => row.email },
            { label: "Relationship", value: (row) => row.relationship },
            { label: "Status", value: (row) => row.status },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-parent-contacts.pdf", "Parent contacts", filteredRows, [
            { label: "Parent name", value: (row) => row.parentName },
            { label: "Students", value: (row) => row.students },
            { label: "Grade", value: (row) => row.grade },
            { label: "Contact number", value: (row) => row.contact },
            { label: "Email address", value: (row) => row.email },
            { label: "Relationship", value: (row) => row.relationship },
            { label: "Status", value: (row) => row.status },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <AdminTable
        headers={[
          { label: "Parent name", className: "w-[18%]" },
          { label: "Student(s)", className: "w-[18%]" },
          { label: "Grade", className: "w-[12%]" },
          { label: "Contact number", className: "w-[15%]" },
          { label: "Email address", className: "w-[20%]" },
          { label: "Relationship", className: "w-[9%]" },
          { label: "Status", className: "w-[8%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={`${row.parentName}-${row.email}-${row.students}`}>
              <td className="font-bold">{row.parentName}</td>
              <td>{row.students}</td>
              <td>{row.grade}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.contact}</td>
              <td>{row.email}</td>
              <td>{row.relationship}</td>
              <td>
                <StatusPill tone={row.status === "Linked" ? "active" : "pending"}>{row.status}</StatusPill>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7} className="text-center text-[#5a6070]">
              {rows.length === 0 ? "No linked parent records yet." : "No parent records match the current filters."}
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
