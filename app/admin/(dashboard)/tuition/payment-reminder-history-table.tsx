"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, CheckSquare, Search, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardTablePagination, filterByQuery, usePaginatedRows } from "@/app/_components/table-controls";
import {
  archivePaymentRemindersAction,
  restorePaymentRemindersAction,
  type ReminderArchiveActionState,
} from "@/app/admin/reminders/actions";
import type { PaymentReminderHistoryRow } from "@/lib/admin/real-data";
import { cn } from "@/lib/utils";

import { AdminTable } from "../../_components/admin-ui";

const initialActionState: ReminderArchiveActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

export function PaymentReminderHistoryTable({
  activeRows,
  archivedRows,
}: {
  activeRows: PaymentReminderHistoryRow[];
  archivedRows: PaymentReminderHistoryRow[];
}) {
  const [view, setView] = useState<"active" | "archived">("active");
  const rows = view === "archived" ? archivedRows : activeRows;
  const action = view === "archived" ? restorePaymentRemindersAction : archivePaymentRemindersAction;
  const [actionState, formAction, pending] = useActionState(action, initialActionState);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmationIds, setConfirmationIds] = useState<number[]>([]);
  const filteredRows = useMemo(() => {
    const searchedRows = filterByQuery(rows, query, (row) => [
      row.student,
      row.parent,
      row.grade,
      row.channel,
      row.status,
      row.message,
      row.created,
      row.archivedAt,
    ].filter(Boolean).join(" "));

    return status === "all"
      ? searchedRows
      : searchedRows.filter((row) => row.status.toLowerCase() === status);
  }, [query, rows, status]);
  const pagination = usePaginatedRows(filteredRows, `${view}|${query}|${status}`);
  const pageIds = pagination.pageRows.map((row) => row.notificationId);
  const selectedSet = new Set(selectedIds);
  const allPageRowsSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));

  useEffect(() => {
    if (actionState.status === "idle") return;

    const showToast = actionState.status === "error"
      ? toast.error
      : actionState.status === "info"
        ? toast.info
        : toast.success;
    showToast(actionState.title, { description: actionState.description });

    if (actionState.status === "success") {
      setSelectedIds([]);
      setConfirmationIds([]);
    }
  }, [actionState]);

  const toggleRow = (notificationId: number) => {
    setSelectedIds((current) => current.includes(notificationId)
      ? current.filter((id) => id !== notificationId)
      : [...current, notificationId]);
  };
  const selectVisible = () => {
    setSelectedIds((current) => [...new Set([...current, ...pageIds])]);
  };
  const changeView = (nextView: "active" | "archived") => {
    setView(nextView);
    setSelectedIds([]);
    setConfirmationIds([]);
  };
  const confirmAction = () => {
    const formData = new FormData();
    confirmationIds.forEach((notificationId) => formData.append("notificationIds", String(notificationId)));
    startTransition(() => formAction(formData));
  };
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || status !== "all";
  const operationLabel = view === "archived" ? "Restore" : "Archive";

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="inline-flex min-h-11 rounded-lg border border-black/10 bg-[#f1f2f5] p-1"
            role="tablist"
            aria-label="Payment reminder history view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "active"}
              onClick={() => changeView("active")}
              className={viewTabClass(view === "active")}
            >
              Active reminders
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "archived"}
              onClick={() => changeView("archived")}
              className={viewTabClass(view === "archived")}
            >
              Archived reminders
            </button>
          </div>
          <div className="text-[11.5px] text-[#5a6070]">
            {selectedIds.length} {selectedIds.length === 1 ? "reminder" : "reminders"} selected
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-black/15 bg-[#f7f8fa] px-3 py-2 sm:max-w-[280px]">
            <Search className="size-4 shrink-0 text-[#9ba3b8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[#9ba3b8]"
              placeholder="Search reminder history..."
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 rounded-lg border border-black/15 bg-[#f7f8fa] px-3 text-[12.5px] outline-none focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10"
            aria-label="Filter reminder status"
          >
            <option value="all">All statuses</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>
          <button type="button" onClick={selectVisible} disabled={pageIds.length === 0 || allPageRowsSelected} className={secondaryButtonClass}>
            <CheckSquare className="size-4" /> Select visible
          </button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0} className={secondaryButtonClass}>
            <X className="size-4" /> Clear selection
          </button>
          <button
            type="button"
            onClick={() => setConfirmationIds(selectedIds)}
            disabled={selectedIds.length === 0 || pending}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#0f1117] bg-[#0f1117] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#2d3348] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-50"
          >
            {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {operationLabel} selected
          </button>
        </div>
      </div>

      <AdminTable
        headers={[
          { label: "Select", className: "w-[64px]" },
          { label: "Created", className: "w-[130px]" },
          { label: "Student", className: "w-[170px]" },
          { label: "Parent", className: "w-[170px]" },
          { label: "Grade", className: "w-[110px]" },
          { label: "Channel", className: "w-[100px]" },
          { label: "Status", className: "w-[100px]" },
          ...(view === "archived" ? [{ label: "Archived", className: "w-[130px]" }] : []),
          { label: "Message", className: "w-[220px]" },
          { label: "Action", className: "w-[72px] text-center" },
        ]}
      >
        {pagination.pageRows.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={row.notificationId}>
              <td>
                <label className="flex min-h-11 items-center" aria-label={`Select reminder for ${row.student}`}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(row.notificationId)}
                    onChange={() => toggleRow(row.notificationId)}
                    className="size-4 accent-[#e64a19]"
                  />
                </label>
              </td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.created}</td>
              <td className="font-bold">{row.student}</td>
              <td>{row.parent}</td>
              <td>{row.grade}</td>
              <td>{row.channel}</td>
              <td><span className={statusClassName(row.status)}>{row.status}</span></td>
              {view === "archived" ? <td className="font-mono text-[11px] text-[#5a6070]">{row.archivedAt}</td> : null}
              <td className="max-w-[240px] truncate text-[#5a6070]" title={row.message}>{row.message}</td>
              <td className="text-center">
                <button
                  type="button"
                  onClick={() => setConfirmationIds([row.notificationId])}
                  disabled={pending}
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:border-[#e64a19]/40 hover:bg-[#fff5f2] hover:text-[#e64a19] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:opacity-50"
                  aria-label={`${operationLabel} reminder for ${row.student}`}
                  title={`${operationLabel} reminder`}
                >
                  {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={view === "archived" ? 10 : 9} className="text-center text-[#5a6070]">
              {emptyState(view, hasRows, hasFilters)}
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

      {confirmationIds.length > 0 ? (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-[#0f1117]/45 px-4 py-6 backdrop-blur-sm">
          <button type="button" className="fixed inset-0 cursor-default" onClick={() => setConfirmationIds([])} aria-label="Close confirmation" />
          <section role="alertdialog" aria-modal="true" aria-labelledby="reminder-archive-title" className="relative w-full max-w-md rounded-xl border border-black/[0.07] bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-[#fff3e0] text-[#e65100]">
              {view === "archived" ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
            </div>
            <h3 id="reminder-archive-title" className="text-[16px] font-bold text-[#0f1117]">
              {operationLabel} {confirmationIds.length === 1 ? "this reminder" : `${confirmationIds.length} reminders`}?
            </h3>
            <p className="mt-2 text-[12.5px] leading-5 text-[#5a6070]">
              {view === "archived"
                ? "Restored reminders return to Active reminders. Their delivery status and audit details stay unchanged."
                : "Archived reminders move out of the active table but remain available for audit and can be restored."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmationIds([])} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button type="button" onClick={confirmAction} disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#e64a19] px-4 text-[12.5px] font-semibold text-white hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:opacity-60 sm:w-auto">
                {pending ? "Updating..." : `${operationLabel} reminders`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-[12.5px] font-semibold text-[#5a6070] transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-50";

function viewTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-md px-3 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
    active ? "bg-white text-[#0f1117] shadow-sm" : "text-[#5a6070] hover:text-[#0f1117]",
  );
}

function emptyState(view: "active" | "archived", hasRows: boolean, hasFilters: boolean) {
  if (hasRows && hasFilters) return "No reminders match the current filters.";
  if (view === "archived") return "No archived payment reminders yet.";
  return "No payment reminder history yet.";
}

function statusClassName(status: string) {
  const base = "inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-[11px] font-bold";
  if (status.toLowerCase() === "sent") return `${base} bg-[#e7f5e9] text-[#2e7d32]`;
  if (status.toLowerCase() === "failed") return `${base} bg-[#fdebec] text-[#c62828]`;
  return `${base} bg-[#fff3e0] text-[#e65100]`;
}
