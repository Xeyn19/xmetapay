"use client";

import { useMemo, useState } from "react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import type { ParentStudentLinkRequest } from "@/lib/parents/student-claims";

import { AdminTable, StatusPill } from "../../_components/admin-ui";
import { reviewParentStudentLinkRequestAction } from "./actions";

export function StudentLinkRequestsTable({
  rows,
  returnTo = "/admin/parents",
}: {
  rows: ParentStudentLinkRequest[];
  returnTo?: "/admin/parents" | "/admin/students";
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => status === "all" || row.status === status),
      query,
      (row) => [row.parentName, row.parentEmail, row.relationship, row.studentName, row.studentReference].join(" "),
    ),
    [query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}`);
  const hasActiveFilters = query.trim() !== "" || status !== "all";
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
  };

  return (
    <>
      <div className="border-b border-border px-4 py-3 sm:px-[18px]">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search parent, student, or reference..."
          searchLabel="Search student connection requests by parent, student, email, or reference"
          filters={[
            { label: "Request status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
          ]}
          onClear={resetFilters}
          clearLabel="Reset filters"
          clearDisabled={!hasActiveFilters}
          layout="compact"
          activeFilterCount={status === "all" ? 0 : 1}
          filterTitle="Filter connection requests"
          filterDescription="Narrow the review queue by request status."
        />
      </div>
      <AdminTable headers={[
        { label: "Parent" },
        { label: "Student" },
        { label: "Submitted" },
        { label: "Status" },
        { label: "Actions" },
      ]}>
        {pagination.pageRows.length ? pagination.pageRows.map((row) => <tr key={row.id}>
          <td className="!whitespace-normal"><strong>{row.parentName}</strong><div className="break-all text-[11px] text-muted-foreground">{row.parentEmail} · {row.relationship}</div></td>
          <td className="!whitespace-normal"><strong>{row.studentName}</strong><div className="font-mono text-[11px] text-muted-foreground">{row.studentReference}</div></td>
          <td>{row.submittedAt}</td>
          <td><StatusPill tone={row.status === "Approved" ? "active" : row.status === "Pending" ? "pending" : "inactive"}>{row.status}</StatusPill></td>
          <td className="!whitespace-normal !overflow-visible">
            {row.status === "Pending" ? <form action={reviewParentStudentLinkRequestAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="requestId" value={row.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" name="decision" value="approve" onClick={(event) => { if (!window.confirm(`Approve ${row.parentName}'s connection to ${row.studentName}?`)) event.preventDefault(); }} className="min-h-11 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25">Approve</button>
              <button type="submit" name="decision" value="reject" onClick={(event) => { if (!window.confirm("Reject this connection request?")) event.preventDefault(); }} className="min-h-11 rounded-lg border border-destructive/40 px-3 text-xs font-bold text-destructive focus:outline-none focus-visible:ring-3 focus-visible:ring-destructive/25">Reject</button>
            </form> : <span className="text-xs text-muted-foreground">Reviewed</span>}
          </td>
        </tr>) : <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">
          {rows.length === 0 ? "No student connection requests yet." : <span>No connection requests match the current filters. <button type="button" onClick={resetFilters} className="ml-1 min-h-11 font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reset filters</button></span>}
        </td></tr>}
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
