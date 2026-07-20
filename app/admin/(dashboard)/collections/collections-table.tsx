"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckSquare, X } from "lucide-react";
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
  archiveTuitionCollectionsAction,
  restoreTuitionCollectionsAction,
  type CollectionArchiveActionState,
} from "@/app/admin/collections/actions";
import type { AdminCollectionDisplayRow } from "@/lib/admin/real-data";
import { cn } from "@/lib/utils";

import { AdminTable, StatusPill } from "../../_components/admin-ui";

export type CollectionRow = AdminCollectionDisplayRow;

const initialActionState: CollectionArchiveActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

export function CollectionsTable({
  activeRows,
  archivedRows,
}: {
  activeRows: CollectionRow[];
  archivedRows: CollectionRow[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"active" | "archived">("active");
  const [activeCollectionRows, setActiveCollectionRows] = useState(activeRows);
  const [archivedCollectionRows, setArchivedCollectionRows] = useState(archivedRows);
  const rows = view === "archived" ? archivedCollectionRows : activeCollectionRows;
  const action = view === "archived" ? restoreTuitionCollectionsAction : archiveTuitionCollectionsAction;
  const [pending, startActionTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmationIds, setConfirmationIds] = useState<number[]>([]);

  const filteredRows = useMemo(() => {
    return filterByQuery(
      rows.filter((row) =>
        (status === "all" || row.status === status)
        && (channel === "all" || row.channel === channel)),
      query,
      (row) => Object.values(row).filter(Boolean).join(" "),
    );
  }, [channel, query, rows, status]);
  const pagination = usePaginatedRows(filteredRows, `${view}|${query}|${status}|${channel}`);
  const pageIds = pagination.pageRows.map((row) => row.paymentId);
  const rowIds = useMemo(() => new Set(rows.map((row) => row.paymentId)), [rows]);
  const validSelectedIds = selectedIds.filter((id) => rowIds.has(id));
  const selectedSet = new Set(validSelectedIds);
  const allPageRowsSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const operationLabel = view === "archived" ? "Restore" : "Archive";
  const exportColumns = collectionExportColumns(view === "archived");

  const changeView = (nextView: "active" | "archived") => {
    setView(nextView);
    setQuery("");
    setStatus("all");
    setChannel("all");
    setSelectedIds([]);
    setConfirmationIds([]);
  };
  const toggleRow = (paymentId: number) => {
    setSelectedIds((current) => current.includes(paymentId)
      ? current.filter((id) => id !== paymentId)
      : [...current, paymentId]);
  };
  const selectVisible = () => {
    setSelectedIds((current) => [...new Set([...current, ...pageIds])]);
  };
  const confirmAction = () => {
    const submittedIds = [...confirmationIds];
    const submittedView = view;
    const formData = new FormData();
    submittedIds.forEach((paymentId) => formData.append("paymentIds", String(paymentId)));
    setConfirmationIds([]);
    startActionTransition(async () => {
      const result = await action(initialActionState, formData);
      const showToast = result.status === "error"
        ? toast.error
        : result.status === "info"
          ? toast.info
          : toast.success;

      showToast(result.title, { description: result.description });

      if (result.status === "success") {
        const submittedSet = new Set(submittedIds);

        if (submittedView === "active") {
          const movedRows = activeCollectionRows
            .filter((row) => submittedSet.has(row.paymentId))
            .map((row) => ({ ...row, archivedAt: "Just now" }));
          setActiveCollectionRows((current) => current.filter((row) => !submittedSet.has(row.paymentId)));
          setArchivedCollectionRows((current) => [
            ...movedRows,
            ...current.filter((row) => !submittedSet.has(row.paymentId)),
          ]);
        } else {
          const movedRows = archivedCollectionRows
            .filter((row) => submittedSet.has(row.paymentId))
            .map((row) => ({ ...row, archivedAt: null }));
          setArchivedCollectionRows((current) => current.filter((row) => !submittedSet.has(row.paymentId)));
          setActiveCollectionRows((current) => [
            ...movedRows,
            ...current.filter((row) => !submittedSet.has(row.paymentId)),
          ]);
        }

        setSelectedIds((current) => current.filter((id) => !submittedSet.has(id)));
        router.refresh();
      }
    });
  };
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || status !== "all" || channel !== "all";

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="inline-flex min-h-11 rounded-lg border border-black/10 bg-[#f1f2f5] p-1"
            role="tablist"
            aria-label="Tuition collection history view"
          >
            <button type="button" role="tab" aria-selected={view === "active"} onClick={() => changeView("active")} className={viewTabClass(view === "active")}>
              Active collections ({activeCollectionRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "archived"} onClick={() => changeView("archived")} className={viewTabClass(view === "archived")}>
              Archived collections ({archivedCollectionRows.length})
            </button>
          </div>
          <p className="text-[11.5px] text-[#5a6070]">
            {validSelectedIds.length} {validSelectedIds.length === 1 ? "collection" : "collections"} selected
          </p>
        </div>

        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search student, ref, tuition term..."
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
            view === "archived" ? "admin-collections-archived.csv" : "admin-collections-active.csv",
            filteredRows,
            exportColumns,
          )}
          onExportPdf={() => exportRowsToPdf(
            view === "archived" ? "admin-collections-archived.pdf" : "admin-collections-active.pdf",
            view === "archived" ? "Archived tuition collections" : "Active tuition collections",
            filteredRows,
            exportColumns,
          )}
          exportDisabled={filteredRows.length === 0}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={selectVisible} disabled={pageIds.length === 0 || allPageRowsSelected} className={secondaryButtonClass}>
            <CheckSquare className="size-4" /> Select visible
          </button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={validSelectedIds.length === 0} className={secondaryButtonClass}>
            <X className="size-4" /> Clear selection
          </button>
          <button
            type="button"
            onClick={() => setConfirmationIds(validSelectedIds)}
            disabled={validSelectedIds.length === 0 || pending}
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
          { label: "Ref #", className: "w-[100px]" },
          { label: "Student", className: "w-[170px]" },
          { label: "Class", className: "w-[110px]" },
          { label: "Tuition record", className: "w-[180px]" },
          { label: "Amount", className: "w-[110px]" },
          { label: "Date & time", className: "w-[145px]" },
          { label: "Channel", className: "w-[110px]" },
          { label: "Status", className: "w-[90px]" },
          ...(view === "archived" ? [{ label: "Archived", className: "w-[145px]" }] : []),
          { label: "Action", className: "w-[72px] text-center" },
        ]}
      >
        {pagination.pageRows.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={row.paymentId}>
              <td>
                <label className="flex min-h-11 items-center" aria-label={`Select collection ${row.ref}`}>
                  <input type="checkbox" checked={selectedSet.has(row.paymentId)} onChange={() => toggleRow(row.paymentId)} className="size-4 accent-[#e64a19]" />
                </label>
              </td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.ref}</td>
              <td className="font-bold">{row.student}</td>
              <td>{row.grade}</td>
              <td>{row.fee}</td>
              <td className="font-bold text-[#e64a19]">{row.amount}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.date}</td>
              <td>{row.channel}</td>
              <td><StatusPill tone={row.status === "Partial" ? "partial" : row.status === "Paid" || row.status === "Done" ? "paid" : "pending"}>{row.status}</StatusPill></td>
              {view === "archived" ? <td className="font-mono text-[11px] text-[#5a6070]">{row.archivedAt ?? "Pending"}</td> : null}
              <td className="text-center">
                <button
                  type="button"
                  onClick={() => setConfirmationIds([row.paymentId])}
                  disabled={pending}
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:border-[#e64a19]/40 hover:bg-[#fff5f2] hover:text-[#e64a19] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:opacity-50"
                  aria-label={`${operationLabel} collection ${row.ref}`}
                  title={`${operationLabel} collection`}
                >
                  {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={view === "archived" ? 11 : 10} className="text-center text-[#5a6070]">
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
          <section role="alertdialog" aria-modal="true" aria-labelledby="collection-archive-title" className="relative w-full max-w-md rounded-xl border border-black/[0.07] bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-[#fff3e0] text-[#e65100]">
              {view === "archived" ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
            </div>
            <h3 id="collection-archive-title" className="text-[16px] font-bold text-[#0f1117]">
              {operationLabel} {confirmationIds.length === 1 ? "this collection" : `${confirmationIds.length} collections`}?
            </h3>
            <p className="mt-2 text-[12.5px] leading-5 text-[#5a6070]">
              {view === "archived"
                ? "Restored collections return to the active log. Payment status, receipts, balances, and parent history stay unchanged."
                : "Archived collections move out of the active log but remain in financial totals, reports, receipts, and parent history."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmationIds([])} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button type="button" onClick={confirmAction} disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#e64a19] px-4 text-[12.5px] font-semibold text-white hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:opacity-60 sm:w-auto">
                {pending ? "Updating..." : `${operationLabel} collections`}
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

function collectionExportColumns(includeArchived: boolean): ExportColumn<CollectionRow>[] {
  return [
    { label: "Reference", value: (row) => row.ref },
    { label: "Student", value: (row) => row.student },
    { label: "Grade", value: (row) => row.grade },
    { label: "Tuition record", value: (row) => row.fee },
    { label: "Amount", value: (row) => row.amount },
    { label: "Date and time", value: (row) => row.date },
    { label: "Channel", value: (row) => row.channel },
    { label: "Status", value: (row) => row.status },
    ...(includeArchived ? [{ label: "Archived", value: (row: CollectionRow) => row.archivedAt }] : []),
  ];
}

function emptyState(view: "active" | "archived", hasRows: boolean, hasFilters: boolean) {
  if (hasRows && hasFilters) return "No tuition collections match the current filters.";
  if (view === "archived") return "No archived tuition collections yet.";
  return "No tuition payment records yet.";
}
