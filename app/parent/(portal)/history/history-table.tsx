"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckSquare, LockKeyhole, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  DashboardTableControls,
  DashboardTablePagination,
  type ExportColumn,
  exportRowsToCsv,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import {
  archiveParentPaymentHistoryAction,
  permanentlyDeleteParentPaymentHistoryAction,
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
  operation: "archive" | "restore" | "delete";
};

export function ParentPaymentHistoryTable({
  activeRows,
  archivedRows,
}: {
  activeRows: ParentPaymentHistoryRow[];
  archivedRows: ParentPaymentHistoryRow[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"active" | "archived">("active");
  const [activePaymentRows, setActivePaymentRows] = useState(activeRows);
  const [archivedPaymentRows, setArchivedPaymentRows] = useState(archivedRows);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, startActionTransition] = useTransition();
  const rows = view === "archived" ? archivedPaymentRows : activePaymentRows;
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
      ].filter(Boolean).join(" "),
    ),
    [channel, query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${view}|${query}|${status}|${channel}`);
  const selectablePageIds = pagination.pageRows
    .filter((row) => view === "archived" || row.archiveEligible)
    .map((row) => row.paymentId);
  const rowIds = useMemo(() => new Set(rows.map((row) => row.paymentId)), [rows]);
  const validSelectedIds = selectedIds.filter((id) => rowIds.has(id));
  const selectedSet = new Set(validSelectedIds);
  const allSelectablePageRowsSelected = selectablePageIds.length > 0
    && selectablePageIds.every((id) => selectedSet.has(id));
  const exportColumns = historyExportColumns(view === "archived");

  const changeView = (nextView: "active" | "archived") => {
    setView(nextView);
    setQuery("");
    setStatus("all");
    setChannel("all");
    setSelectedIds([]);
    setConfirmation(null);
  };

  const toggleRow = (row: ParentPaymentHistoryRow) => {
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
        : permanentlyDeleteParentPaymentHistoryAction;
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
        setArchivedPaymentRows((current) => current.filter((row) => !updatedSet.has(row.paymentId)));
      }

      setSelectedIds((current) => current.filter((id) => !updatedSet.has(id)));
      router.refresh();
    });
  };

  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || status !== "all" || channel !== "all";
  const columnCount = view === "archived" ? 10 : 9;

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-black/[0.08] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex min-h-11 rounded-[10px] border border-black/10 bg-[#f2f1ef] p-1" role="tablist" aria-label="Payment history view">
            <button type="button" role="tab" aria-selected={view === "active"} onClick={() => changeView("active")} className={viewTabClass(view === "active")}>
              Current payments ({activePaymentRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "archived"} onClick={() => changeView("archived")} className={viewTabClass(view === "archived")}>
              Archived payments ({archivedPaymentRows.length})
            </button>
          </div>
          <p className="text-[12px] text-[#6b6b6b]">
            {validSelectedIds.length} {validSelectedIds.length === 1 ? "payment" : "payments"} selected
          </p>
        </div>

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
          onExport={() => exportRowsToCsv(
            view === "archived" ? "parent-payment-history-archived.csv" : "parent-payment-history.csv",
            filteredRows,
            exportColumns,
          )}
          onExportPdf={() => exportRowsToPdf(
            view === "archived" ? "parent-payment-history-archived.pdf" : "parent-payment-history.pdf",
            view === "archived" ? "Archived payment history" : "Payment history",
            filteredRows,
            exportColumns,
          )}
          exportDisabled={filteredRows.length === 0}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSelectedIds((current) => [...new Set([...current, ...selectablePageIds])])} disabled={selectablePageIds.length === 0 || allSelectablePageRowsSelected} className={secondaryButtonClass}>
            <CheckSquare className="size-4" /> Select visible
          </button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={validSelectedIds.length === 0} className={secondaryButtonClass}>
            <X className="size-4" /> Clear selection
          </button>
          <button type="button" onClick={() => setConfirmation({ ids: validSelectedIds, operation: view === "archived" ? "restore" : "archive" })} disabled={validSelectedIds.length === 0 || pending} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#e64a19] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-60">
            {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {view === "archived" ? "Restore selected" : "Archive selected"}
          </button>
          {view === "archived" ? (
            <button type="button" onClick={() => setConfirmation({ ids: validSelectedIds, operation: "delete" })} disabled={validSelectedIds.length === 0 || pending} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-red-600 bg-white px-3.5 text-[13px] font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-3 focus-visible:ring-red-600/25 disabled:pointer-events-none disabled:opacity-60">
              <Trash2 className="size-4" />
              Delete selected
            </button>
          ) : null}
        </div>

        {view === "active" ? (
          <p className="text-[11.5px] leading-5 text-[#6b6b6b]">
            Finished payments can be archived. Pending payments stay visible until processing is complete.
          </p>
        ) : null}
      </div>

      <ParentTable
        tableClassName="min-w-[1120px]"
        headers={[
          { label: "Select", className: "w-[64px]" },
          { label: "Ref #", className: "w-[150px]" },
          { label: "Date", className: "w-[130px]" },
          { label: "Student", className: "w-[160px]" },
          { label: "Description", className: "w-[200px]" },
          { label: "Amount", className: "w-[100px]" },
          { label: "Channel", className: "w-[120px]" },
          { label: "Status", className: "w-[100px]" },
          ...(view === "archived" ? [{ label: "Archived", className: "w-[150px]" }] : []),
          { label: "Action", className: view === "archived" ? "w-[120px] text-center" : "w-[72px] text-center" },
        ]}
      >
        {pagination.pageRows.length > 0 ? (
          pagination.pageRows.map((row) => {
            const selectable = view === "archived" || row.archiveEligible;
            const refContent = row.receiptId ? (
              <Link href={`/parent/receipt?receiptId=${row.receiptId}`} className="text-[#e64a19] hover:underline">
                {row.referenceNumber}
              </Link>
            ) : row.referenceNumber;

            return (
              <tr key={row.paymentId}>
                <td>
                  <label className="flex min-h-11 items-center" aria-label={`Select payment ${row.referenceNumber}`}>
                    <input type="checkbox" checked={selectedSet.has(row.paymentId)} onChange={() => toggleRow(row)} disabled={!selectable || pending} className="size-4 accent-[#e64a19] disabled:opacity-40" />
                  </label>
                </td>
                <td className="font-mono text-[11px] text-[#6b6b6b]">{refContent}</td>
                <td>{row.paidAt}</td>
                <td className="font-medium">{row.studentName}</td>
                <td>{row.description}</td>
                <td className="font-semibold">{row.amount}</td>
                <td>{row.channel}</td>
                <td><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></td>
                {view === "archived" ? <td className="font-mono text-[11px] text-[#6b6b6b]">{row.archivedAt ?? "Pending"}</td> : null}
                <td className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => selectable && setConfirmation({ ids: [row.paymentId], operation: view === "archived" ? "restore" : "archive" })}
                    disabled={!selectable || pending}
                    className="size-11 text-[#6b6b6b] hover:border-[#e64a19]/40 hover:bg-[#fff5f2] hover:text-[#e64a19]"
                    aria-label={selectable ? `${operationLabel} payment ${row.referenceNumber}` : `Payment ${row.referenceNumber} cannot be archived while pending`}
                    title={selectable ? `${operationLabel} payment` : "Pending payments cannot be archived"}
                  >
                    {!selectable ? <LockKeyhole className="size-4" /> : view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  </Button>
                  {view === "archived" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setConfirmation({ ids: [row.paymentId], operation: "delete" })}
                      disabled={pending}
                      className="ml-2 size-11 border-red-200 text-red-700 hover:border-red-400 hover:bg-red-50 hover:text-red-800"
                      aria-label={`Permanently delete payment ${row.referenceNumber}`}
                      title="Permanently delete payment"
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
          <section role="alertdialog" aria-modal="true" aria-labelledby="parent-payment-archive-title" className="relative w-full max-w-md rounded-xl border border-black/[0.08] bg-white p-5 shadow-2xl sm:p-6">
            <div className={cn("mb-4 flex size-10 items-center justify-center rounded-lg", confirmation.operation === "delete" ? "bg-red-50 text-red-700" : "bg-[#fbe9e7] text-[#e64a19]")}>
              {confirmation.operation === "delete" ? <Trash2 className="size-5" /> : confirmation.operation === "restore" ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
            </div>
            <h3 id="parent-payment-archive-title" className="text-[17px] font-semibold text-[#1a1a1a]">
              {confirmation.operation === "delete"
                ? `Permanently delete ${confirmation.ids.length === 1 ? "this payment" : `${confirmation.ids.length} payments`}?`
                : `${confirmation.operation === "restore" ? "Restore" : "Archive"} ${confirmation.ids.length === 1 ? "this payment" : `${confirmation.ids.length} payments`}?`}
            </h3>
            <p className="mt-2 text-[13px] leading-5 text-[#6b6b6b]">
              {confirmation.operation === "delete"
                ? "This cannot be undone in the parent portal. The payment disappears from this parent's Payment history and exports, while receipts, balances, allocations, dashboard activity, and school records remain preserved."
                : confirmation.operation === "restore"
                  ? "Restored records return to Current payments. Receipts, balances, allocations, and school records stay unchanged."
                  : "Archived records move out of Current payments for this parent account only. Receipts and financial records stay unchanged."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" autoFocus onClick={() => setConfirmation(null)} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button type="button" onClick={confirmAction} disabled={pending} className={cn("inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] px-4 text-[13px] font-medium text-white transition focus:outline-none focus-visible:ring-3 disabled:opacity-60 sm:w-auto", confirmation.operation === "delete" ? "bg-red-700 hover:bg-red-800 focus-visible:ring-red-600/25" : "bg-[#e64a19] hover:bg-[#bf360c] focus-visible:ring-[#e64a19]/25")}>
                {pending ? "Updating..." : confirmation.operation === "delete" ? "Permanently delete" : `${confirmation.operation === "restore" ? "Restore" : "Archive"} payments`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function historyExportColumns(includeArchived: boolean): ExportColumn<ParentPaymentHistoryRow>[] {
  return [
    { label: "Reference", value: (row) => row.referenceNumber },
    { label: "Date", value: (row) => row.paidAt },
    { label: "Student", value: (row) => row.studentName },
    { label: "Description", value: (row) => row.description },
    { label: "Amount", value: (row) => row.amount },
    { label: "Channel", value: (row) => row.channel },
    { label: "Status", value: (row) => row.status },
    ...(includeArchived ? [{ label: "Archived", value: (row: ParentPaymentHistoryRow) => row.archivedAt }] : []),
  ];
}

function statusTone(status: string) {
  if (status === "Paid") return "green" as const;
  if (status === "Pending") return "amber" as const;
  if (status === "Refunded") return "blue" as const;
  return "red" as const;
}

function emptyState(view: "active" | "archived", hasRows: boolean, hasFilters: boolean) {
  if (hasFilters) return "No payment records match the current filters.";
  if (view === "archived") return "No archived payments yet.";
  if (!hasRows) return "No payment records yet.";
  return "No current payment records yet.";
}

function viewTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-md px-3 text-[12px] font-medium transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20",
    active ? "bg-white text-[#1a1a1a] shadow-sm" : "text-[#6b6b6b] hover:text-[#1a1a1a]",
  );
}

const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-black/10 bg-white px-3.5 text-[13px] font-medium text-[#4b4b4b] transition hover:bg-[#f8f7f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20 disabled:pointer-events-none disabled:opacity-50";
