"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, LockKeyhole, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  DashboardTableControls,
  DashboardTablePagination,
  type ExportColumn,
  exportRowsToExcel,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import {
  archiveParentPaymentHistoryAction,
  permanentlyDeleteParentPaymentHistoryAction,
  recoverRemovedParentPaymentHistoryAction,
  restoreParentPaymentHistoryAction,
  type ParentPaymentHistoryArchiveActionState,
} from "@/app/parent/history/actions";
import { Button } from "@/components/ui/button";
import type { ParentPaymentHistoryRow } from "@/lib/payments/records";
import { cn } from "@/lib/utils";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

const initialActionState: ParentPaymentHistoryArchiveActionState = {
  status: "idle",
  title: "",
  description: "",
  updatedIds: [],
  submittedAt: 0,
};

type Confirmation = {
  ids: number[];
  operation: "archive" | "restore" | "delete" | "recover";
};

type HistoryView = "active" | "archived" | "removed";

export function ParentPaymentHistoryTable({
  activeRows,
  archivedRows,
  removedRows,
}: {
  activeRows: ParentPaymentHistoryRow[];
  archivedRows: ParentPaymentHistoryRow[];
  removedRows: ParentPaymentHistoryRow[];
}) {
  const router = useRouter();
  const [view, setView] = useState<HistoryView>("active");
  const [activePaymentRows, setActivePaymentRows] = useState(activeRows);
  const [archivedPaymentRows, setArchivedPaymentRows] = useState(archivedRows);
  const [removedPaymentRows, setRemovedPaymentRows] = useState(removedRows);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, startActionTransition] = useTransition();
  const rows = view === "archived" ? archivedPaymentRows : view === "removed" ? removedPaymentRows : activePaymentRows;
  const operationLabel = view === "archived" ? "Restore" : "Archive";

  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) =>
        (status === "all" || row.status === status)
        && (channel === "all" || row.channel === channel)
      ),
      query,
      (row) => [
        row.referenceNumber,
        row.paidAt,
        row.studentName,
        row.description,
        row.amount,
        row.channel,
        row.status,
        row.archivedAt,
        row.deletedAt,
        row.recoverableUntil,
        row.removalState,
      ].filter(Boolean).join(" "),
    ),
    [channel, query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${view}|${query}|${status}|${channel}`);
  const selectablePageIds = pagination.pageRows
    .filter((row) => view === "removed" ? row.canRecover : view === "archived" || row.archiveEligible)
    .map((row) => row.paymentId);
  const rowIds = useMemo(() => new Set(rows.map((row) => row.paymentId)), [rows]);
  const validSelectedIds = selectedIds.filter((id) => rowIds.has(id));
  const selectedSet = new Set(validSelectedIds);
  const allSelectablePageRowsSelected = selectablePageIds.length > 0
    && selectablePageIds.every((id) => selectedSet.has(id));
  const exportColumns = historyExportColumns(view);
  const exportTitle = view === "archived" ? "Archived payment history" : view === "removed" ? "Removed payment history" : "Payment history";
  const exportOptions = {
    context: [{ label: "View", value: exportTitle }],
    filters: [
      { label: "Search", value: query.trim() || "All payments" },
      { label: "Status", value: status === "all" ? "All" : status },
      { label: "Channel", value: channel === "all" ? "All" : channel },
    ],
    summary: [
      { label: "Payments", value: filteredRows.length },
      { label: "Total amount", value: formatMoney(filteredRows.reduce((total, row) => total + parseMoney(row.amount), 0)) },
    ],
  };

  const changeView = (nextView: HistoryView) => {
    setView(nextView);
    setQuery("");
    setStatus("all");
    setChannel("all");
    setSelectedIds([]);
    setConfirmation(null);
  };

  const toggleRow = (row: ParentPaymentHistoryRow) => {
    if (view === "removed" && !row.canRecover) return;
    if (view === "active" && !row.archiveEligible) return;
    setSelectedIds((current) => current.includes(row.paymentId)
      ? current.filter((id) => id !== row.paymentId)
      : [...current, row.paymentId]);
  };

  const confirmAction = () => {
    if (!confirmation) return;
    const submittedOperation = confirmation.operation;
    const action = submittedOperation === "archive"
      ? archiveParentPaymentHistoryAction
      : submittedOperation === "restore"
        ? restoreParentPaymentHistoryAction
        : submittedOperation === "delete"
          ? permanentlyDeleteParentPaymentHistoryAction
          : recoverRemovedParentPaymentHistoryAction;
    const formData = new FormData();
    confirmation.ids.forEach((id) => formData.append("paymentIds", String(id)));
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
        const movedRows = activePaymentRows
          .filter((row) => updatedSet.has(row.paymentId))
          .map((row) => ({ ...row, archivedAt: "Just now" }));
        setActivePaymentRows((current) => current.filter((row) => !updatedSet.has(row.paymentId)));
        setArchivedPaymentRows((current) => [
          ...movedRows,
          ...current.filter((row) => !updatedSet.has(row.paymentId)),
        ]);
      } else if (submittedOperation === "restore") {
        const movedRows = archivedPaymentRows
          .filter((row) => updatedSet.has(row.paymentId))
          .map((row) => ({ ...row, archivedAt: null }));
        setArchivedPaymentRows((current) => current.filter((row) => !updatedSet.has(row.paymentId)));
        setActivePaymentRows((current) => [
          ...movedRows,
          ...current.filter((row) => !updatedSet.has(row.paymentId)),
        ]);
      } else {
        if (submittedOperation === "delete") {
          const movedRows = archivedPaymentRows
            .filter((row) => updatedSet.has(row.paymentId))
            .map((row) => ({ ...row, deletedAt: "Just now", recoverableUntil: "30 days from now", recoveryDaysRemaining: 30, canRecover: true, removalState: "recoverable" as const }));
          setArchivedPaymentRows((current) => current.filter((row) => !updatedSet.has(row.paymentId)));
          setRemovedPaymentRows((current) => [...movedRows, ...current.filter((row) => !updatedSet.has(row.paymentId))]);
        } else {
          const movedRows = removedPaymentRows
            .filter((row) => updatedSet.has(row.paymentId))
            .map((row) => ({ ...row, deletedAt: null, recoverableUntil: null, recoveryDaysRemaining: 0, canRecover: false, removalState: null }));
          setRemovedPaymentRows((current) => current.filter((row) => !updatedSet.has(row.paymentId)));
          setArchivedPaymentRows((current) => [...movedRows, ...current.filter((row) => !updatedSet.has(row.paymentId))]);
        }
      }

      setSelectedIds((current) => current.filter((id) => !updatedSet.has(id)));
      router.refresh();
    });
  };

  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || status !== "all" || channel !== "all";
  const columnCount = view === "active" ? 9 : view === "archived" ? 10 : 12;
  const clearSelectionContext = () => {
    setSelectedIds([]);
    setConfirmation(null);
  };
  const updateQuery = (value: string) => { setQuery(value); clearSelectionContext(); };
  const updateStatus = (value: string) => { setStatus(value); clearSelectionContext(); };
  const updateChannel = (value: string) => { setChannel(value); clearSelectionContext(); };
  const someSelectablePageRowsSelected = selectablePageIds.some((id) => selectedSet.has(id));
  const toggleVisibleRows = () => {
    setSelectedIds((current) => allSelectablePageRowsSelected
      ? current.filter((id) => !selectablePageIds.includes(id))
      : [...new Set([...current, ...selectablePageIds])]);
  };

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid min-h-11 w-full grid-cols-3 rounded-[10px] border border-border bg-muted p-1 sm:w-auto" role="tablist" aria-label="Payment history view">
            <button type="button" role="tab" aria-selected={view === "active"} onClick={() => changeView("active")} className={viewTabClass(view === "active")}>
              Current ({activePaymentRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "archived"} onClick={() => changeView("archived")} className={viewTabClass(view === "archived")}>
              Archived ({archivedPaymentRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "removed"} onClick={() => changeView("removed")} className={viewTabClass(view === "removed")}>
              Removed ({removedPaymentRows.length})
            </button>
          </div>
        </div>

        <DashboardTableControls
          tone="parent"
          layout="compact"
          query={query}
          onQueryChange={updateQuery}
          searchPlaceholder="Search payments…"
          searchLabel="Search payment history by reference, student, description, amount, channel, or status"
          activeFilterCount={Number(status !== "all") + Number(channel !== "all")}
          filterTitle="Filter payment history"
          filterDescription="Narrow this view by processing status or payment channel."
          filters={[
            { label: "Status", value: status, onChange: updateStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Channel", value: channel, onChange: updateChannel, options: toFilterOptions(rows.map((row) => row.channel), "All channels") },
          ]}
          clearLabel="Reset filters"
          clearDisabled={!hasFilters}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setChannel("all");
            clearSelectionContext();
          }}
          onExport={() => exportRowsToExcel(
            view === "archived" ? "parent-payment-history-archived.xlsx" : view === "removed" ? "parent-payment-history-removed.xlsx" : "parent-payment-history.xlsx",
            exportTitle,
            filteredRows,
            exportColumns,
            {
              worksheetName: view === "archived" ? "Archived payments" : view === "removed" ? "Removed payments" : "Payment history",
              ...exportOptions,
            },
          )}
          onExportPdf={() => exportRowsToPdf(
            view === "archived" ? "parent-payment-history-archived.pdf" : view === "removed" ? "parent-payment-history-removed.pdf" : "parent-payment-history.pdf",
            exportTitle,
            filteredRows,
            exportColumns,
            exportOptions,
          )}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredRows.length === 0}
        />

        {validSelectedIds.length > 0 ? <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2" role="status">
          <span className="px-2 text-sm font-semibold text-foreground">{validSelectedIds.length} selected</span>
          <button type="button" onClick={() => setSelectedIds([])} disabled={validSelectedIds.length === 0} className={secondaryButtonClass}>
            <X className="size-4" /> Clear selection
          </button>
          <button type="button" onClick={() => setConfirmation({ ids: validSelectedIds, operation: view === "removed" ? "recover" : view === "archived" ? "restore" : "archive" })} disabled={validSelectedIds.length === 0 || pending} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-primary bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60">
            {view !== "active" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {view === "removed" ? "Restore selected to Archived" : view === "archived" ? "Restore selected" : "Archive selected"}
          </button>
          {view === "archived" ? (
            <button type="button" onClick={() => setConfirmation({ ids: validSelectedIds, operation: "delete" })} disabled={validSelectedIds.length === 0 || pending} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-destructive/50 bg-card px-3.5 text-[13px] font-medium text-destructive transition hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-destructive/25 disabled:pointer-events-none disabled:opacity-60">
              <Trash2 className="size-4" />
              Remove selected
            </button>
          ) : null}
        </div> : null}
      </div>

      <ParentTable
        tableClassName="min-w-[1120px]"
        headers={[
          { key: "select", label: <SelectPageCheckbox checked={allSelectablePageRowsSelected} mixed={!allSelectablePageRowsSelected && someSelectablePageRowsSelected} disabled={selectablePageIds.length === 0 || pending} onChange={toggleVisibleRows} label="Select visible payments" />, className: "w-[64px]" },
          { label: "Ref #", className: "w-[150px]" },
          { label: "Date", className: "w-[130px]" },
          { label: "Student", className: "w-[160px]" },
          { label: "Description", className: "w-[200px]" },
          { label: "Amount", className: "w-[100px]" },
          { label: "Channel", className: "w-[120px]" },
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
            const refContent = row.receiptId ? (
              <Link href={`/parent/receipt?receiptId=${row.receiptId}`} className="text-primary hover:underline">
                {row.referenceNumber}
              </Link>
            ) : row.referenceNumber;

            return (
              <tr key={row.paymentId}>
                <td>
                  <label className="flex min-h-11 items-center" aria-label={`Select payment ${row.referenceNumber}`}>
                    <input type="checkbox" checked={selectedSet.has(row.paymentId)} onChange={() => toggleRow(row)} disabled={!selectable || pending} className="size-4 accent-primary disabled:opacity-40" />
                  </label>
                </td>
                <td className="font-mono text-[11px] text-muted-foreground">{refContent}</td>
                <td>{row.paidAt}</td>
                <td className="font-medium">{row.studentName}</td>
                <td>{row.description}</td>
                <td className="font-semibold">{row.amount}</td>
                <td>{row.channel}</td>
                <td><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></td>
                {view === "archived" ? <td className="font-mono text-[11px] text-muted-foreground">{row.archivedAt ?? "Pending"}</td> : null}
                {view === "removed" ? (
                  <>
                    <td className="font-mono text-[11px] text-muted-foreground">{row.deletedAt ?? "Pending"}</td>
                    <td>
                      <div className="text-[12px] font-medium">{row.recoverableUntil ?? "Expired"}</div>
                      <div className="text-[11px] text-muted-foreground">{row.canRecover ? `${row.recoveryDaysRemaining} day${row.recoveryDaysRemaining === 1 ? "" : "s"} remaining` : "Recovery period ended"}</div>
                    </td>
                    <td><StatusPill tone={row.canRecover ? "amber" : "muted"}>{row.canRecover ? "Recoverable" : "Permanently hidden"}</StatusPill></td>
                  </>
                ) : null}
                <td className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => selectable && setConfirmation({ ids: [row.paymentId], operation: view === "removed" ? "recover" : view === "archived" ? "restore" : "archive" })}
                    disabled={!selectable || pending}
                    className="size-11 text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                    aria-label={selectable ? `${view === "removed" ? "Restore to Archived" : operationLabel} payment ${row.referenceNumber}` : view === "removed" ? `Payment ${row.referenceNumber} recovery period has ended` : `Payment ${row.referenceNumber} cannot be archived while pending`}
                    title={selectable ? `${view === "removed" ? "Restore to Archived" : operationLabel} payment` : view === "removed" ? "Recovery period ended" : "Pending payments cannot be archived"}
                  >
                    {!selectable ? <LockKeyhole className="size-4" /> : view !== "active" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  </Button>
                  {view === "archived" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setConfirmation({ ids: [row.paymentId], operation: "delete" })}
                      disabled={pending}
                      className="ml-2 size-11 border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive hover:text-destructive-foreground"
                      aria-label={`Remove payment ${row.referenceNumber} from view`}
                      title="Remove payment from view"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={columnCount} className="text-center text-muted-foreground">{emptyState(view, hasRows, hasFilters)}</td>
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
        <div className="portal-dialog-backdrop fixed inset-0 z-[220] grid place-items-center px-4 py-6">
          <button type="button" className="fixed inset-0 cursor-default" onClick={() => setConfirmation(null)} aria-label="Close confirmation" />
          <section role="alertdialog" aria-modal="true" aria-labelledby="parent-payment-archive-title" className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className={cn("mb-4 flex size-10 items-center justify-center rounded-lg", confirmation.operation === "delete" ? "bg-status-danger-bg text-status-danger-foreground" : "bg-primary/10 text-primary")}>
              {confirmation.operation === "delete" ? <Trash2 className="size-5" /> : confirmation.operation === "restore" ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
            </div>
            <h3 id="parent-payment-archive-title" className="text-[17px] font-semibold text-foreground">
              {confirmation.operation === "delete"
                ? `Remove ${confirmation.ids.length === 1 ? "this payment" : `${confirmation.ids.length} payments`} from view?`
                : `${confirmation.operation === "recover" ? "Restore to Archived" : confirmation.operation === "restore" ? "Restore" : "Archive"} ${confirmation.ids.length === 1 ? "this payment" : `${confirmation.ids.length} payments`}?`}
            </h3>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
              {confirmation.operation === "delete"
                ? "The payment moves to Removed and can be restored to Archived for 30 days. After that it remains visible as Permanently hidden, while all financial and school records stay unchanged."
                : confirmation.operation === "recover"
                  ? "Recoverable payments return to Archived. Expired rows are ignored by the server and remain Permanently hidden."
                : confirmation.operation === "restore"
                  ? "Restored records return to Current payments. Receipts, balances, allocations, and school records stay unchanged."
                  : "Archived records move out of Current payments for this parent account only. Receipts and financial records stay unchanged."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" autoFocus onClick={() => setConfirmation(null)} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button type="button" onClick={confirmAction} disabled={pending} className={cn("inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] px-4 text-[13px] font-medium text-primary-foreground transition focus:outline-none focus-visible:ring-3 disabled:opacity-60 sm:w-auto", confirmation.operation === "delete" ? "bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/25" : "bg-primary hover:bg-primary/90 focus-visible:ring-ring/50")}>
                {pending ? "Updating..." : confirmation.operation === "delete" ? "Remove from view" : confirmation.operation === "recover" ? "Restore to Archived" : `${confirmation.operation === "restore" ? "Restore" : "Archive"} payments`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function historyExportColumns(view: HistoryView): ExportColumn<ParentPaymentHistoryRow>[] {
  return [
    { label: "Reference", value: (row) => row.referenceNumber },
    { label: "Date", value: (row) => row.paidAt },
    { label: "Student", value: (row) => row.studentName },
    { label: "Description", value: (row) => row.description },
    { label: "Amount", value: (row) => row.amount },
    { label: "Channel", value: (row) => row.channel },
    { label: "Status", value: (row) => row.status },
    ...(view === "archived" ? [{ label: "Archived", value: (row: ParentPaymentHistoryRow) => row.archivedAt }] : []),
    ...(view === "removed" ? [
      { label: "Removed", value: (row: ParentPaymentHistoryRow) => row.deletedAt },
      { label: "Recovery deadline", value: (row: ParentPaymentHistoryRow) => row.recoverableUntil },
      { label: "State", value: (row: ParentPaymentHistoryRow) => row.canRecover ? "Recoverable" : "Permanently hidden" },
    ] : []),
  ];
}

function statusTone(status: string) {
  if (status === "Paid") return "green" as const;
  if (status === "Pending") return "amber" as const;
  if (status === "Refunded") return "blue" as const;
  return "red" as const;
}

function emptyState(view: HistoryView, hasRows: boolean, hasFilters: boolean) {
  if (hasFilters) return "No payment records match the current filters.";
  if (view === "archived") return "No archived payments yet.";
  if (view === "removed") return "No removed payments yet.";
  if (!hasRows) return "No payment records yet.";
  return "No current payment records yet.";
}

function viewTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-md px-3 text-[12px] font-medium transition focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function SelectPageCheckbox({ checked, mixed, disabled, onChange, label }: {
  checked: boolean;
  mixed: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="flex min-h-6 items-center" aria-label={label}>
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="size-4 accent-primary disabled:opacity-40" />
    </label>
  );
}

function parseMoney(value: string) {
  const parsed = Number(value.replaceAll(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return `P${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
