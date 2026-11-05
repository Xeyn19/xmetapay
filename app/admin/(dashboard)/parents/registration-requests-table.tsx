"use client";

import { useMemo, useState } from "react";

import { DashboardTableControls, DashboardTablePagination, toFilterOptions, usePaginatedRows } from "@/app/_components/table-controls";
import type { ParentRegistrationRequest } from "@/lib/parents/registration-approval";

import { AdminTable, StatusPill } from "../../_components/admin-ui";
import { reviewParentRegistrationAction } from "./actions";

export function RegistrationRequestsTable({ rows }: { rows: ParentRegistrationRequest[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) =>
      (status === "all" || row.status === status)
      && (!normalizedQuery || [row.name, row.email, row.phone, ...row.references.map((reference) => reference.value)]
        .some((value) => value.toLowerCase().includes(normalizedQuery))),
    );
  }, [query, rows, status]);
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}`);
  const pendingCount = rows.filter((row) => row.status === "Pending approval").length;
  const hasActiveFilters = query.trim() !== "" || status !== "all";
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
  };

  return (
    <>
      <div className="space-y-3 border-b border-border px-4 py-3 sm:px-[18px]">
        <p className="text-xs leading-5 text-muted-foreground">
          School-wide requests · {pendingCount} pending. Review the parent and matching student records before granting access.
        </p>
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search parent, email, phone, or student reference..."
          searchLabel="Search registration requests by parent, email, phone, or student reference"
          filters={[{ label: "Registration status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") }]}
          onClear={resetFilters}
          clearLabel="Reset filters"
          clearDisabled={!hasActiveFilters}
        />
        <p className="text-xs text-muted-foreground" aria-live="polite"><strong className="text-foreground">{filteredRows.length}</strong> {filteredRows.length === 1 ? "request" : "requests"} shown</p>
      </div>
      <p className="px-4 py-2 text-[11px] text-muted-foreground sm:hidden">Swipe the table to see status and review actions.</p>
      <AdminTable headers={[
        { label: "Parent", className: "w-[25%]" },
        { label: "Student matches", className: "w-[32%]" },
        { label: "Submitted", className: "w-[14%]" },
        { label: "Status", className: "w-[13%]" },
        { label: "Actions", className: "w-[16%]" },
      ]}>
        {pagination.pageRows.length > 0 ? pagination.pageRows.map((row) => {
          const matchedCount = row.references.filter((reference) => reference.studentName).length;
          return (
            <tr key={row.userId}>
              <td className="!whitespace-normal">
                <div className="font-bold">{row.name}</div>
                <div className="break-all text-[11px] text-muted-foreground">{row.email}</div>
                <div className="text-[11px] text-muted-foreground">{row.phone} · {row.relationship}</div>
              </td>
              <td className="!whitespace-normal">
                <div className="space-y-1.5">
                  {row.references.map((reference) => (
                    <div key={reference.value} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[11px]">{reference.value}</span>
                      {reference.schoolRecorded ? <span className="text-[11px] font-semibold text-status-info-foreground">School recorded email</span> : null}
                      <span className={reference.studentName ? "text-[11px] text-status-success-foreground" : "text-[11px] text-status-warning-foreground"}>
                        {reference.studentName ? `Matched: ${reference.studentName}` : "No match yet"}
                      </span>
                    </div>
                  ))}
                  {row.references.length === 0 ? <span className="text-[11px] text-status-warning-foreground">No saved reference</span> : null}
                </div>
              </td>
              <td>{row.submittedAt}</td>
              <td>
                <StatusPill tone={row.status === "Approved" ? "active" : row.status === "Pending approval" ? "pending" : "inactive"}>
                  {row.status}
                </StatusPill>
              </td>
              <td className="!whitespace-normal !overflow-visible">
                {row.status === "Pending approval" ? (
                  <form
                    action={reviewParentRegistrationAction}
                    className="flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="parentUserId" value={row.userId} />
                    <button
                      type="submit"
                      name="decision"
                      value="approve"
                      disabled={matchedCount === 0}
                      title={matchedCount === 0 ? "At least one reference or school-recorded email must match a student" : undefined}
                      onClick={(event) => {
                        if (!window.confirm(`Approve ${row.name} and link ${matchedCount} matching student${matchedCount === 1 ? "" : "s"}?`)) {
                          event.preventDefault();
                        }
                      }}
                      className="min-h-11 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="reject"
                      onClick={(event) => {
                        if (!window.confirm(`Reject ${row.name}'s registration? They will not be able to sign in.`)) {
                          event.preventDefault();
                        }
                      }}
                      className="min-h-11 rounded-lg border border-status-danger-foreground/40 px-3 text-xs font-bold text-status-danger-foreground hover:bg-status-danger-bg focus:outline-none focus-visible:ring-3 focus-visible:ring-status-danger-foreground/25"
                    >
                      Reject
                    </button>
                  </form>
                ) : row.status === "Rejected" ? (
                  <form action={reviewParentRegistrationAction}>
                    <input type="hidden" name="parentUserId" value={row.userId} />
                    <button
                      type="submit"
                      name="decision"
                      value="reopen"
                      onClick={(event) => {
                        if (!window.confirm(`Reopen ${row.name}'s registration for review?`)) event.preventDefault();
                      }}
                      className="min-h-11 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      Reopen for review
                    </button>
                  </form>
                ) : <span className="text-xs text-muted-foreground">{row.status === "Disabled" ? "Access disabled" : "Reviewed"}</span>}
              </td>
            </tr>
          );
        }) : (
          <tr>
            <td colSpan={5} className="py-8 text-center text-muted-foreground">
              {rows.length === 0 ? "No parent registration requests yet." : <span>No requests match the current filters. <button type="button" onClick={resetFilters} className="ml-1 min-h-11 font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reset filters</button></span>}
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
