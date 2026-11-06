"use client";

import { startTransition, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, Eye, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardTableControls, DashboardTablePagination, filterByQuery, usePaginatedRows } from "@/app/_components/table-controls";
import {
  archivePaymentRemindersAction,
  restorePaymentRemindersAction,
  type ReminderArchiveActionState,
} from "@/app/admin/reminders/actions";
import type { PaymentReminderHistoryRow } from "@/lib/admin/real-data";
import { readableDisabledControlClass } from "@/lib/ui/control-styles";
import { cn } from "@/lib/utils";

import { AdminTable } from "../../_components/admin-ui";
import { PaymentReminderMessageDialog } from "./payment-reminder-message-dialog";

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
  const [viewingRow, setViewingRow] = useState<PaymentReminderHistoryRow | null>(null);
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectAllVisibleRef = useRef<HTMLInputElement>(null);
  const filteredRows = useMemo(() => {
    const searchedRows = filterByQuery(rows, query, (row) => [
      row.student,
      row.parent,
      row.grade,
      row.channel,
      row.status,
      row.message,
      row.templateName,
      row.subjectLine,
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
  const somePageRowsSelected = pageIds.some((id) => selectedSet.has(id));

  useEffect(() => {
    if (actionState.status === "idle") return;

    const showToast = actionState.status === "error"
      ? toast.error
      : actionState.status === "info"
        ? toast.info
        : toast.success;
    showToast(actionState.title, { description: actionState.description });

    if (actionState.status === "success") {
      const resetSelection = window.setTimeout(() => {
        setSelectedIds([]);
        setConfirmationIds([]);
      }, 0);

      return () => window.clearTimeout(resetSelection);
    }
  }, [actionState]);

  const toggleRow = (notificationId: number) => {
    setSelectedIds((current) => current.includes(notificationId)
      ? current.filter((id) => id !== notificationId)
      : [...current, notificationId]);
  };
  const toggleVisible = () => {
    setSelectedIds((current) => allPageRowsSelected
      ? current.filter((id) => !pageIds.includes(id))
      : [...new Set([...current, ...pageIds])]);
  };
  const changeQuery = (value: string) => {
    setQuery(value);
    setSelectedIds([]);
    setConfirmationIds([]);
  };
  const changeStatus = (value: string) => {
    setStatus(value);
    setSelectedIds([]);
    setConfirmationIds([]);
  };
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setSelectedIds([]);
    setConfirmationIds([]);
  };
  const changeView = (nextView: "active" | "archived") => {
    setView(nextView);
    setSelectedIds([]);
    setConfirmationIds([]);
    setViewingRow(null);
  };
  const closeViewer = useCallback(() => {
    setViewingRow(null);
    window.setTimeout(() => viewTriggerRef.current?.focus(), 0);
  }, []);
  const confirmAction = () => {
    const formData = new FormData();
    confirmationIds.forEach((notificationId) => formData.append("notificationIds", String(notificationId)));
    startTransition(() => formAction(formData));
  };
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || status !== "all";
  const operationLabel = view === "archived" ? "Restore" : "Archive";

  useEffect(() => {
    if (selectAllVisibleRef.current) {
      selectAllVisibleRef.current.indeterminate = somePageRowsSelected && !allPageRowsSelected;
    }
  }, [allPageRowsSelected, somePageRowsSelected]);

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3.5 sm:px-[18px]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div
            className="inline-flex min-h-11 shrink-0 rounded-lg border border-border bg-muted p-1"
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
          <div className="min-w-0 flex-1">
            <DashboardTableControls
              query={query}
              onQueryChange={changeQuery}
              searchPlaceholder="Search reminder history..."
              searchLabel="Search reminder history by student, parent, subject, or message"
              filters={[
                {
                  label: "Reminder status",
                  value: status,
                  onChange: changeStatus,
                  options: [
                    { label: "All statuses", value: "all" },
                    { label: "Sent", value: "sent" },
                    { label: "Queued", value: "queued" },
                    { label: "Failed", value: "failed" },
                  ],
                },
              ]}
              onClear={resetFilters}
              clearLabel="Reset filters"
              clearDisabled={!hasFilters}
              layout="compact"
              activeFilterCount={status === "all" ? 0 : 1}
              filterTitle="Filter reminder history"
              filterDescription="Narrow delivery history by reminder status."
            />
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-button-soft px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <span className="text-xs font-semibold text-foreground" aria-live="polite">
              {selectedIds.length} {selectedIds.length === 1 ? "reminder" : "reminders"} selected
            </span>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button type="button" onClick={() => setSelectedIds([])} className={secondaryButtonClass}>
                <X className="size-4" /> Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmationIds(selectedIds)}
                disabled={pending}
                className={cn("inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-button-secondary bg-button-secondary px-3.5 text-[12.5px] font-semibold text-button-secondary-foreground transition hover:bg-button-secondary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:w-auto", readableDisabledControlClass)}
              >
                {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                {operationLabel} selected
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <AdminTable
        headers={[
          {
            key: "select",
            label: (
              <input
                ref={selectAllVisibleRef}
                type="checkbox"
                checked={allPageRowsSelected}
                disabled={pageIds.length === 0}
                onChange={toggleVisible}
                aria-label="Select all visible reminders"
                className="size-4 accent-primary"
              />
            ),
            className: "w-[64px]",
          },
          { label: "Created", className: "w-[130px]" },
          { label: "Student", className: "w-[170px]" },
          { label: "Parent", className: "w-[170px]" },
          { label: "Grade", className: "w-[110px]" },
          { label: "Channel", className: "w-[100px]" },
          { label: "Status", className: "w-[100px]" },
          ...(view === "archived" ? [{ label: "Archived", className: "w-[130px]" }] : []),
          { label: "Message", className: "w-[220px]" },
          { label: "Actions", className: "w-[124px] text-center" },
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
                    className="size-4 accent-primary"
                  />
                </label>
              </td>
              <td className="font-mono text-[11px] text-muted-foreground">{row.created}</td>
              <td className="font-bold">{row.student}</td>
              <td>{row.parent}</td>
              <td>{row.grade}</td>
              <td>{row.channel}</td>
              <td><span className={statusClassName(row.status)}>{row.status}</span></td>
              {view === "archived" ? <td className="font-mono text-[11px] text-muted-foreground">{row.archivedAt}</td> : null}
              <td className="max-w-[240px] text-muted-foreground">
                <div className="line-clamp-2 break-words [overflow-wrap:anywhere]">
                  {row.message.trim() || "Message unavailable"}
                </div>
                {row.templateName ? <div className="mt-1 truncate text-[10.5px] text-muted-foreground">{row.templateName}</div> : null}
              </td>
              <td className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      viewTriggerRef.current = event.currentTarget;
                      setConfirmationIds([]);
                      setViewingRow(row);
                    }}
                    className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:bg-button-soft hover:text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                    aria-label={`View message for ${row.student}`}
                  >
                    <Eye className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewingRow(null);
                      setConfirmationIds([row.notificationId]);
                    }}
                    disabled={pending}
                    className={cn("inline-flex size-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:bg-button-soft hover:text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25", readableDisabledControlClass)}
                    aria-label={`${operationLabel} reminder for ${row.student}`}
                  >
                    {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={view === "archived" ? 10 : 9} className="text-center text-muted-foreground">
              {hasRows && hasFilters ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <span>No reminders match the current filters.</span>
                  <button type="button" onClick={resetFilters} className={secondaryButtonClass}>Reset filters</button>
                </div>
              ) : emptyState(view)}
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

      <PaymentReminderMessageDialog row={viewingRow} onClose={closeViewer} />

      {confirmationIds.length > 0 ? (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-[#0f1117]/45 px-4 py-6 backdrop-blur-sm">
          <button type="button" className="fixed inset-0 cursor-default" onClick={() => setConfirmationIds([])} aria-label="Close confirmation" />
          <section role="alertdialog" aria-modal="true" aria-labelledby="reminder-archive-title" className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-status-warning-bg text-status-warning-foreground">
              {view === "archived" ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
            </div>
            <h3 id="reminder-archive-title" className="text-[16px] font-bold text-foreground">
              {operationLabel} {confirmationIds.length === 1 ? "this reminder" : `${confirmationIds.length} reminders`}?
            </h3>
            <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
              {view === "archived"
                ? "Restored reminders return to Active reminders. Their delivery status and audit details stay unchanged."
                : "Archived reminders move out of the active table but remain available for audit and can be restored."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmationIds([])} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button type="button" onClick={confirmAction} disabled={pending} className={cn("inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:w-auto", readableDisabledControlClass)}>
                {pending ? "Updating..." : `${operationLabel} reminders`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

const secondaryButtonClass = cn("inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[12.5px] font-semibold text-muted-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:w-auto", readableDisabledControlClass);

function viewTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-11 items-center justify-center rounded-md px-3 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
}

function emptyState(view: "active" | "archived") {
  if (view === "archived") return "No archived payment reminders yet.";
  return "No payment reminder history yet.";
}

function statusClassName(status: string) {
  const base = "inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-[11px] font-bold";
  if (status.toLowerCase() === "sent") return `${base} bg-status-success-bg text-status-success-foreground`;
  if (status.toLowerCase() === "failed") return `${base} bg-status-danger-bg text-status-danger-foreground`;
  return `${base} bg-status-warning-bg text-status-warning-foreground`;
}
