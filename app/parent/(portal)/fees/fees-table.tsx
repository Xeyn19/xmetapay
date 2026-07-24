"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckSquare, LockKeyhole, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  DashboardTableControls,
  DashboardTablePagination,
  type ExportColumn,
  exportRowsToCsv,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import {
  archiveParentFeeAssignmentsAction,
  permanentlyDeleteParentFeeAssignmentsAction,
  recoverRemovedParentFeeAssignmentsAction,
  restoreParentFeeAssignmentsAction,
  type ParentFeeArchiveActionState,
} from "@/app/parent/fees/actions";
import { Button } from "@/components/ui/button";
import type { ParentFeeRow } from "@/lib/fees/records";
import { cn } from "@/lib/utils";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

const initialActionState: ParentFeeArchiveActionState = {
  status: "idle",
  title: "",
  description: "",
  updatedIds: [],
  submittedAt: 0,
};

type FeeConfirmation = {
  ids: number[];
  operation: "archive" | "restore" | "delete" | "recover";
};

type FeeView = "active" | "archived" | "removed";

export function ParentFeesTable({
  activeRows,
  archivedRows,
  removedRows,
}: {
  activeRows: ParentFeeRow[];
  archivedRows: ParentFeeRow[];
  removedRows: ParentFeeRow[];
}) {
  const router = useRouter();
  const [view, setView] = useState<FeeView>("active");
  const [activeFeeRows, setActiveFeeRows] = useState(activeRows);
  const [archivedFeeRows, setArchivedFeeRows] = useState(archivedRows);
  const [removedFeeRows, setRemovedFeeRows] = useState(removedRows);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState<FeeConfirmation | null>(null);
  const [pending, startActionTransition] = useTransition();
  const rows = view === "archived" ? archivedFeeRows : view === "removed" ? removedFeeRows : activeFeeRows;
  const operationLabel = view === "archived" ? "Restore" : "Archive";

  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) =>
        (category === "all" || row.category === category)
        && (status === "all" || row.status === status)
      ),
      query,
      (row) => [
        row.studentName,
        row.studentReference,
        row.feeName,
        row.category,
        row.status,
        row.dueDate,
        row.deletedAt,
        row.recoverableUntil,
        row.removalState,
        ...row.terms.flatMap((term) => [term.name, term.status, term.dueDate]),
      ].join(" "),
    ),
    [category, query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${view}|${query}|${category}|${status}`);
  const selectablePageIds = pagination.pageRows
    .filter((row) => view === "removed" ? row.canRecover : view === "archived" || row.archiveEligible)
    .map((row) => row.id);
  const rowIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  const validSelectedIds = selectedIds.filter((id) => rowIds.has(id));
  const selectedSet = new Set(validSelectedIds);
  const allSelectablePageRowsSelected = selectablePageIds.length > 0
    && selectablePageIds.every((id) => selectedSet.has(id));
  const exportColumns = feeExportColumns(view);

  const changeView = (nextView: FeeView) => {
    setView(nextView);
    setQuery("");
    setCategory("all");
    setStatus("all");
    setSelectedIds([]);
    setConfirmation(null);
  };

  const toggleRow = (row: ParentFeeRow) => {
    if (view === "removed" && !row.canRecover) return;
    if (view === "active" && !row.archiveEligible) return;
    setSelectedIds((current) => current.includes(row.id)
      ? current.filter((id) => id !== row.id)
      : [...current, row.id]);
  };

  const confirmAction = () => {
    if (!confirmation) return;

    const submittedOperation = confirmation.operation;
    const action = submittedOperation === "archive"
      ? archiveParentFeeAssignmentsAction
      : submittedOperation === "restore"
        ? restoreParentFeeAssignmentsAction
        : submittedOperation === "delete"
          ? permanentlyDeleteParentFeeAssignmentsAction
          : recoverRemovedParentFeeAssignmentsAction;
    const formData = new FormData();
    confirmation.ids.forEach((id) => formData.append("feeAssignmentIds", String(id)));
    setConfirmation(null);

    startActionTransition(async () => {
      const result = await action(initialActionState, formData);
      const showToast = result.status === "error"
        ? toast.error
        : result.status === "info"
          ? toast.info
          : toast.success;
      showToast(result.title, { description: result.description });

      if (result.status !== "success") return;

      const updatedSet = new Set(result.updatedIds);
      if (submittedOperation === "archive") {
        const movedRows = activeFeeRows
          .filter((row) => updatedSet.has(row.id))
          .map((row) => ({ ...row, archivedAt: "Just now" }));
        setActiveFeeRows((current) => current.filter((row) => !updatedSet.has(row.id)));
        setArchivedFeeRows((current) => [
          ...movedRows,
          ...current.filter((row) => !updatedSet.has(row.id)),
        ]);
      } else if (submittedOperation === "restore") {
        const movedRows = archivedFeeRows
          .filter((row) => updatedSet.has(row.id))
          .map((row) => ({ ...row, archivedAt: null }));
        setArchivedFeeRows((current) => current.filter((row) => !updatedSet.has(row.id)));
        setActiveFeeRows((current) => [
          ...movedRows,
          ...current.filter((row) => !updatedSet.has(row.id)),
        ]);
      } else {
        if (submittedOperation === "delete") {
          const movedRows = archivedFeeRows
            .filter((row) => updatedSet.has(row.id))
            .map((row) => ({
              ...row,
              deletedAt: "Just now",
              recoverableUntil: "30 days from now",
              recoveryDaysRemaining: 30,
              canRecover: true,
              removalState: "recoverable" as const,
            }));
          setArchivedFeeRows((current) => current.filter((row) => !updatedSet.has(row.id)));
          setRemovedFeeRows((current) => [...movedRows, ...current.filter((row) => !updatedSet.has(row.id))]);
        } else {
          const movedRows = removedFeeRows
            .filter((row) => updatedSet.has(row.id))
            .map((row) => ({ ...row, deletedAt: null, recoverableUntil: null, recoveryDaysRemaining: 0, canRecover: false, removalState: null }));
          setRemovedFeeRows((current) => current.filter((row) => !updatedSet.has(row.id)));
          setArchivedFeeRows((current) => [...movedRows, ...current.filter((row) => !updatedSet.has(row.id))]);
        }
      }

      setSelectedIds((current) => current.filter((id) => !updatedSet.has(id)));
      router.refresh();
    });
  };

  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || category !== "all" || status !== "all";
  const columnCount = view === "active" ? 9 : view === "archived" ? 10 : 12;
  const confirmationLabel = confirmation?.operation === "archive"
    ? "Archive"
    : confirmation?.operation === "restore"
      ? "Restore"
      : confirmation?.operation === "recover"
        ? "Restore to Archived"
        : "Remove from view";

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-black/[0.08] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid min-h-11 w-full grid-cols-3 rounded-[10px] border border-black/10 bg-[#f2f1ef] p-1 sm:w-auto" role="tablist" aria-label="Fee summary view">
            <button type="button" role="tab" aria-selected={view === "active"} onClick={() => changeView("active")} className={viewTabClass(view === "active")}>
              Current ({activeFeeRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "archived"} onClick={() => changeView("archived")} className={viewTabClass(view === "archived")}>
              Archived ({archivedFeeRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "removed"} onClick={() => changeView("removed")} className={viewTabClass(view === "removed")}>
              Removed ({removedFeeRows.length})
            </button>
          </div>
          <p className="text-[12px] text-[#6b6b6b]">
            {validSelectedIds.length} {validSelectedIds.length === 1 ? "fee" : "fees"} selected
          </p>
        </div>

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
          onExport={() => exportRowsToCsv(
            view === "archived" ? "parent-fee-summary-archived.csv" : view === "removed" ? "parent-fee-summary-removed.csv" : "parent-fee-summary.csv",
            filteredRows,
            exportColumns,
          )}
          onExportPdf={() => exportParentFeeSummaryPdf(filteredRows, view)}
          exportDisabled={filteredRows.length === 0}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSelectedIds((current) => [...new Set([...current, ...selectablePageIds])])} disabled={selectablePageIds.length === 0 || allSelectablePageRowsSelected} className={secondaryButtonClass}>
            <CheckSquare className="size-4" /> Select visible
          </button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={validSelectedIds.length === 0} className={secondaryButtonClass}>
            <X className="size-4" /> Clear selection
          </button>
          <button
            type="button"
            onClick={() => setConfirmation({
              ids: validSelectedIds,
              operation: view === "removed" ? "recover" : view === "archived" ? "restore" : "archive",
            })}
            disabled={validSelectedIds.length === 0 || pending}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#e64a19] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-60"
          >
            {view !== "active" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {view === "removed" ? "Restore selected to Archived" : `${operationLabel} selected`}
          </button>
          {view === "archived" ? (
            <button
              type="button"
              onClick={() => setConfirmation({
                ids: validSelectedIds,
                operation: "delete",
              })}
              disabled={validSelectedIds.length === 0 || pending}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#c62828] bg-[#c62828] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#8e1b1b] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#c62828]/25 disabled:pointer-events-none disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              Remove selected
            </button>
          ) : null}
        </div>

        {view === "active" ? (
          <p className="text-[11.5px] leading-5 text-[#6b6b6b]">
            Only paid or zero-balance fees can be archived. Outstanding fees stay in Current fees until settled.
          </p>
        ) : view === "removed" ? (
          <p className="text-[11.5px] leading-5 text-[#6b6b6b]">
            Removed fees can be restored to Archived for 30 days. After the deadline they remain visible as Permanently hidden and cannot be restored.
          </p>
        ) : null}
      </div>

      <ParentTable
        tableClassName="min-w-[1080px]"
        headers={[
          { label: "Select", className: "w-[64px]" },
          { label: "Student", className: "w-[170px]" },
          { label: "Fee", className: "w-[160px]" },
          { label: "Billed", className: "w-[105px]" },
          { label: "Paid", className: "w-[105px]" },
          { label: "Balance", className: "w-[105px]" },
          { label: "Due date", className: "w-[130px]" },
          { label: "Status", className: "w-[100px]" },
          ...(view === "archived" ? [{ label: "Archived", className: "w-[150px]" }] : []),
          ...(view === "removed" ? [
            { label: "Removed", className: "w-[145px]" },
            { label: "Recovery", className: "w-[180px]" },
            { label: "State", className: "w-[145px]" },
          ] : []),
          { label: "Action", className: view === "archived" ? "w-[120px] text-center" : "w-[90px] text-center" },
        ]}
      >
        {pagination.pageRows.length > 0 ? (
          pagination.pageRows.map((row) => {
            const selectable = view === "removed" ? row.canRecover : view === "archived" || row.archiveEligible;
            return (
              <Fragment key={row.id}>
                <tr>
                  <td>
                    <label className="flex min-h-11 items-center" aria-label={`Select ${row.feeName} for ${row.studentName}`}>
                      <input type="checkbox" checked={selectedSet.has(row.id)} onChange={() => toggleRow(row)} disabled={!selectable || pending} className="size-4 accent-[#e64a19] disabled:opacity-40" />
                    </label>
                  </td>
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
                  {view === "archived" ? <td className="font-mono text-[11px] text-[#6b6b6b]">{row.archivedAt ?? "Pending"}</td> : null}
                  {view === "removed" ? (
                    <>
                      <td className="font-mono text-[11px] text-[#6b6b6b]">{row.deletedAt ?? "Pending"}</td>
                      <td>
                        <div className="text-[12px] font-medium">{row.recoverableUntil ?? "Expired"}</div>
                        <div className="text-[11px] text-[#6b6b6b]">{row.canRecover ? `${row.recoveryDaysRemaining} day${row.recoveryDaysRemaining === 1 ? "" : "s"} remaining` : "Recovery period ended"}</div>
                      </td>
                      <td><StatusPill tone={row.canRecover ? "amber" : "muted"}>{row.canRecover ? "Recoverable" : "Permanently hidden"}</StatusPill></td>
                    </>
                  ) : null}
                  <td>
                    <div className="flex min-h-11 items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => selectable && setConfirmation({
                          ids: [row.id],
                          operation: view === "removed" ? "recover" : view === "archived" ? "restore" : "archive",
                        })}
                        disabled={!selectable || pending}
                        className="size-11 text-[#6b6b6b] hover:border-[#e64a19]/40 hover:bg-[#fff5f2] hover:text-[#e64a19]"
                        aria-label={selectable ? `${view === "removed" ? "Restore to Archived" : operationLabel} ${row.feeName} for ${row.studentName}` : view === "removed" ? `${row.feeName} recovery period has ended` : `${row.feeName} cannot be archived until settled`}
                        title={selectable ? `${view === "removed" ? "Restore to Archived" : operationLabel} fee` : view === "removed" ? "Recovery period ended" : "Outstanding fees cannot be archived"}
                      >
                        {!selectable ? <LockKeyhole className="size-4" /> : view !== "active" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                      </Button>
                      {view === "archived" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setConfirmation({
                            ids: [row.id],
                            operation: "delete",
                          })}
                          disabled={pending}
                          className="size-11 border-[#c62828]/25 text-[#c62828] hover:border-[#c62828]/50 hover:bg-[#fff1f1] hover:text-[#8e1b1b]"
                          aria-label={`Remove ${row.feeName} for ${row.studentName} from view`}
                          title="Remove fee from view"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {row.terms.length > 0 ? (
                  <tr className="bg-[#fffaf7]">
                    <td colSpan={columnCount} className="!overflow-visible !whitespace-normal px-4 py-3">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#9a3412]">Tuition payment terms</div>
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
                            {!term.payable && term.status !== "Paid" ? <div className="mt-1 text-[11px] text-[#6b6b6b]">Visible now, not payable for this status.</div> : null}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })
        ) : (
          <tr>
            <td colSpan={columnCount} className="text-center text-[#6b6b6b]">{emptyState(view, hasRows, hasFilters)}</td>
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

      {confirmation ? (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-[#1a1a1a]/45 px-4 py-6 backdrop-blur-sm">
          <button type="button" className="fixed inset-0 cursor-default" onClick={() => setConfirmation(null)} aria-label="Close confirmation" />
          <section role="alertdialog" aria-modal="true" aria-labelledby="parent-fee-archive-title" className="relative w-full max-w-md rounded-xl border border-black/[0.08] bg-white p-5 shadow-2xl sm:p-6">
            <div className={cn(
              "mb-4 flex size-10 items-center justify-center rounded-lg",
              confirmation.operation === "delete"
                ? "bg-[#ffebee] text-[#c62828]"
                : "bg-[#fbe9e7] text-[#e64a19]",
            )}>
              {confirmation.operation === "delete"
                ? <Trash2 className="size-5" />
                : confirmation.operation === "restore"
                  ? <ArchiveRestore className="size-5" />
                  : <Archive className="size-5" />}
            </div>
            <h3 id="parent-fee-archive-title" className="text-[17px] font-semibold text-[#1a1a1a]">
              {confirmationLabel} {confirmation.ids.length === 1 ? "this fee" : `${confirmation.ids.length} fees`}?
            </h3>
            <p className="mt-2 text-[13px] leading-5 text-[#6b6b6b]">
              {confirmation.operation === "delete"
                ? "The fees move to Removed and can be restored to Archived for 30 days. After that they remain visible as Permanently hidden, while all school and financial records stay unchanged."
                : confirmation.operation === "recover"
                  ? "Recoverable fees return to Archived. Expired rows are ignored by the server and remain Permanently hidden."
                : confirmation.operation === "restore"
                  ? "Restored fees return to Current fees. Payments, balances, tuition terms, and school records stay unchanged."
                  : "Archived fees move out of Current fees for this parent account only. Payment and school records stay unchanged."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" autoFocus onClick={() => setConfirmation(null)} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button
                type="button"
                onClick={confirmAction}
                disabled={pending}
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] px-4 text-[13px] font-medium text-white transition focus:outline-none focus-visible:ring-3 disabled:opacity-60 sm:w-auto",
                  confirmation.operation === "delete"
                    ? "bg-[#c62828] hover:bg-[#8e1b1b] focus-visible:ring-[#c62828]/25"
                    : "bg-[#e64a19] hover:bg-[#bf360c] focus-visible:ring-[#e64a19]/25",
                )}
              >
                {pending ? "Updating..." : `${confirmationLabel} fees`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-black/15 bg-white px-3.5 text-[13px] font-medium text-[#6b6b6b] transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-50";

function viewTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-[12.5px] font-medium transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
    active ? "bg-white text-[#1a1a1a] shadow-sm" : "text-[#6b6b6b] hover:text-[#1a1a1a]",
  );
}

function feeExportColumns(view: FeeView): ExportColumn<ParentFeeRow>[] {
  return [
    { label: "Student", value: (row) => row.studentName },
    { label: "Reference", value: (row) => row.studentReference },
    { label: "Fee", value: (row) => row.feeName },
    { label: "Category", value: (row) => row.category },
    { label: "Billed", value: (row) => row.amountDue },
    { label: "Paid", value: (row) => row.amountPaid },
    { label: "Balance", value: (row) => row.balance },
    { label: "Due date", value: (row) => row.dueDate },
    { label: "Status", value: (row) => row.status },
    ...(view === "archived" ? [{ label: "Archived", value: (row: ParentFeeRow) => row.archivedAt }] : []),
    ...(view === "removed" ? [
      { label: "Removed", value: (row: ParentFeeRow) => row.deletedAt },
      { label: "Recovery deadline", value: (row: ParentFeeRow) => row.recoverableUntil },
      { label: "State", value: (row: ParentFeeRow) => row.canRecover ? "Recoverable" : "Permanently hidden" },
    ] : []),
  ];
}

function emptyState(view: FeeView, hasRows: boolean, hasFilters: boolean) {
  if (hasRows && hasFilters) return "No fee records match the current filters.";
  if (view === "archived") return "No archived fees yet.";
  if (view === "removed") return "No removed fees yet.";
  return "No assigned fees yet.";
}

function exportParentFeeSummaryPdf(rows: ParentFeeRow[], view: FeeView) {
  const doc = new jsPDF({ orientation: "landscape" });
  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const columns = ["Student", "Reference", "Fee", "Category", "Billed", "Paid", "Balance", "Due date", "Status", ...(view === "archived" ? ["Archived"] : []), ...(view === "removed" ? ["Removed", "Recovery deadline", "State"] : [])];
  const body = rows.length > 0
    ? rows.flatMap((row) => [
        [row.studentName, row.studentReference, row.feeName, row.category === "tuition" ? "Tuition" : "Other fee", row.amountDue, row.amountPaid, row.balance, row.dueDate, row.status, ...(view === "archived" ? [row.archivedAt ?? "Pending"] : []), ...(view === "removed" ? [row.deletedAt ?? "Pending", row.recoverableUntil ?? "Expired", row.canRecover ? "Recoverable" : "Permanently hidden"] : [])],
        ...row.terms.map((term) => ["", "", `Term: ${term.name}`, "Tuition term", term.amountDue, term.amountPaid, term.balance, term.dueDate, term.status, ...(view === "archived" ? [""] : []), ...(view === "removed" ? ["", "", ""] : [])]),
      ])
    : [["No records yet", ...Array.from({ length: columns.length - 1 }, () => "")]];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("XMETA Pay", 14, 16);
  doc.setFontSize(12);
  doc.text(view === "archived" ? "Archived fee summary" : view === "removed" ? "Removed fee history" : "Current fee summary", 14, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${generatedAt}`, 14, 30);

  autoTable(doc, {
    head: [columns],
    body,
    margin: { left: 14, right: 14 },
    startY: 36,
    styles: { cellPadding: 2, fontSize: 7, overflow: "linebreak" },
    headStyles: { fillColor: [230, 74, 25], textColor: [255, 255, 255] },
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

  doc.save(view === "archived" ? "parent-fee-summary-archived.pdf" : view === "removed" ? "parent-fee-summary-removed.pdf" : "parent-fee-summary.pdf");
}
