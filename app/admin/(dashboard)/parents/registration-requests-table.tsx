"use client";

import { useMemo, useState } from "react";

import { DashboardTablePagination, usePaginatedRows } from "@/app/_components/table-controls";
import type { ParentRegistrationRequest } from "@/lib/parents/registration-approval";

import { AdminTable, SearchInput, StatusPill, fieldControlClass } from "../../_components/admin-ui";
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

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-[18px]">
        <p className="text-xs leading-5 text-[#5a6070]">
          School-wide requests · {pendingCount} pending. Review the parent and matching student records before granting access.
        </p>
        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Search requests..." />
          <label className="sr-only" htmlFor="parent-registration-status">Filter registration status</label>
          <select
            id="parent-registration-status"
            className={fieldControlClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="Pending approval">Pending approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>
      </div>
      <p className="px-4 py-2 text-[11px] text-[#5a6070] sm:hidden">Swipe the table to see status and review actions.</p>
      <AdminTable headers={[
        { label: "Parent", className: "w-[25%]" },
        { label: "Student references", className: "w-[32%]" },
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
                <div className="break-all text-[11px] text-[#5a6070]">{row.email}</div>
                <div className="text-[11px] text-[#5a6070]">{row.phone} · {row.relationship}</div>
              </td>
              <td className="!whitespace-normal">
                <div className="space-y-1.5">
                  {row.references.map((reference) => (
                    <div key={reference.value} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[11px]">{reference.value}</span>
                      <span className={reference.studentName ? "text-[11px] text-[#2e7d32]" : "text-[11px] text-[#9a5b00]"}>
                        {reference.studentName ? `Matched: ${reference.studentName}` : "No match yet"}
                      </span>
                    </div>
                  ))}
                  {row.references.length === 0 ? <span className="text-[11px] text-[#9a5b00]">No saved reference</span> : null}
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
                      title={matchedCount === 0 ? "At least one student reference must match this school" : undefined}
                      onClick={(event) => {
                        if (!window.confirm(`Approve ${row.name} and link ${matchedCount} matching student${matchedCount === 1 ? "" : "s"}?`)) {
                          event.preventDefault();
                        }
                      }}
                      className="min-h-11 rounded-lg bg-[#e64a19] px-3 text-xs font-bold text-white hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="min-h-11 rounded-lg border border-[#c62828]/40 px-3 text-xs font-bold text-[#c62828] hover:bg-[#c62828]/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-[#c62828]/25"
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
                      className="min-h-11 rounded-lg border border-black/15 px-3 text-xs font-bold text-[#0f1117] hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                    >
                      Reopen for review
                    </button>
                  </form>
                ) : <span className="text-xs text-[#5a6070]">{row.status === "Disabled" ? "Access disabled" : "Reviewed"}</span>}
              </td>
            </tr>
          );
        }) : (
          <tr>
            <td colSpan={5} className="py-8 text-center text-[#5a6070]">
              {rows.length === 0 ? "No parent registration requests yet." : "No requests match the current filters."}
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
