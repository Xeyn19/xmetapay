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
  usePaginatedRows,
} from "@/app/_components/table-controls";
import {
  archiveAllowanceWalletsAction,
  restoreAllowanceWalletsAction,
  type AllowanceArchiveActionState,
} from "@/app/admin/allowance/actions";
import type { AdminAllowanceDisplayRow } from "@/lib/admin/real-data";
import { cn } from "@/lib/utils";

import { AdminTable, SegmentedTabs, StatusPill } from "../../_components/admin-ui";

export type AllowanceRow = AdminAllowanceDisplayRow;

type WalletStatusFilter = "all" | "Active" | "Low" | "No balance";
type ArchiveView = "active" | "archived";

const initialActionState: AllowanceArchiveActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

const statusTabs: Array<{ label: string; value: WalletStatusFilter }> = [
  { label: "All students", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Low balance", value: "Low" },
  { label: "Zero balance", value: "No balance" },
];

export function AllowanceTable({
  activeRows,
  archivedRows,
}: {
  activeRows: AllowanceRow[];
  archivedRows: AllowanceRow[];
}) {
  const router = useRouter();
  const [view, setView] = useState<ArchiveView>("active");
  const [activeWalletRows, setActiveWalletRows] = useState(activeRows);
  const [archivedWalletRows, setArchivedWalletRows] = useState(archivedRows);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WalletStatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmationIds, setConfirmationIds] = useState<number[]>([]);
  const [pending, startActionTransition] = useTransition();
  const rows = view === "archived" ? archivedWalletRows : activeWalletRows;
  const action = view === "archived" ? restoreAllowanceWalletsAction : archiveAllowanceWalletsAction;
  const operationLabel = view === "archived" ? "Restore" : "Archive";

  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => status === "all" || row.status === status),
      query,
      (row) => Object.values(row).filter(Boolean).join(" "),
    ),
    [query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${view}|${query}|${status}`);
  const pageIds = pagination.pageRows.map((row) => row.walletId);
  const rowIds = useMemo(() => new Set(rows.map((row) => row.walletId)), [rows]);
  const validSelectedIds = selectedIds.filter((id) => rowIds.has(id));
  const selectedSet = new Set(validSelectedIds);
  const allPageRowsSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const exportColumns = allowanceExportColumns(view === "archived");

  const changeView = (nextView: ArchiveView) => {
    setView(nextView);
    setQuery("");
    setStatus("all");
    setSelectedIds([]);
    setConfirmationIds([]);
  };

  const toggleRow = (walletId: number) => {
    setSelectedIds((current) => current.includes(walletId)
      ? current.filter((id) => id !== walletId)
      : [...current, walletId]);
  };

  const confirmAction = () => {
    const submittedIds = [...confirmationIds];
    const submittedView = view;
    const formData = new FormData();
    submittedIds.forEach((walletId) => formData.append("walletIds", String(walletId)));
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
          const movedRows = activeWalletRows
            .filter((row) => submittedSet.has(row.walletId))
            .map((row) => ({ ...row, archivedAt: "Just now" }));
          setActiveWalletRows((current) => current.filter((row) => !submittedSet.has(row.walletId)));
          setArchivedWalletRows((current) => [
            ...movedRows,
            ...current.filter((row) => !submittedSet.has(row.walletId)),
          ]);
        } else {
          const movedRows = archivedWalletRows
            .filter((row) => submittedSet.has(row.walletId))
            .map((row) => ({ ...row, archivedAt: null }));
          setArchivedWalletRows((current) => current.filter((row) => !submittedSet.has(row.walletId)));
          setActiveWalletRows((current) => [
            ...movedRows,
            ...current.filter((row) => !submittedSet.has(row.walletId)),
          ]);
        }

        setSelectedIds((current) => current.filter((id) => !submittedSet.has(id)));
        router.refresh();
      }
    });
  };

  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || status !== "all";

  return (
    <>
      <div className="space-y-3 border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex min-h-11 rounded-lg border border-black/10 bg-[#f1f2f5] p-1" role="tablist" aria-label="Allowance ledger archive view">
            <button type="button" role="tab" aria-selected={view === "active"} onClick={() => changeView("active")} className={viewTabClass(view === "active")}>
              Active wallets ({activeWalletRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "archived"} onClick={() => changeView("archived")} className={viewTabClass(view === "archived")}>
              Archived wallets ({archivedWalletRows.length})
            </button>
          </div>
          <p className="text-[11.5px] text-[#5a6070]">
            {validSelectedIds.length} {validSelectedIds.length === 1 ? "wallet" : "wallets"} selected
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12.5px] font-semibold text-[#0f1117]">Wallet status filter</div>
            <div className="mt-0.5 text-[11.5px] text-[#5a6070]">
              Review balances or focus on students who may need a top-up.
            </div>
          </div>
          <SegmentedTabs tabs={statusTabs} active={status} onChange={setStatus} />
        </div>

        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search wallets..."
          onClear={() => {
            setQuery("");
            setStatus("all");
          }}
          onExport={() => exportRowsToCsv(
            view === "archived" ? "admin-allowance-wallets-archived.csv" : "admin-allowance-wallets.csv",
            filteredRows,
            exportColumns,
          )}
          onExportPdf={() => exportRowsToPdf(
            view === "archived" ? "admin-allowance-wallets-archived.pdf" : "admin-allowance-wallets.pdf",
            view === "archived" ? "Archived allowance wallets" : "Active allowance wallets",
            filteredRows,
            exportColumns,
          )}
          exportDisabled={filteredRows.length === 0}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSelectedIds((current) => [...new Set([...current, ...pageIds])])} disabled={pageIds.length === 0 || allPageRowsSelected} className={secondaryButtonClass}>
            <CheckSquare className="size-4" /> Select visible
          </button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={validSelectedIds.length === 0} className={secondaryButtonClass}>
            <X className="size-4" /> Clear selection
          </button>
          <button type="button" onClick={() => setConfirmationIds(validSelectedIds)} disabled={validSelectedIds.length === 0 || pending} className={primaryDarkButtonClass}>
            {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {operationLabel} selected
          </button>
        </div>
      </div>

      <AdminTable
        headers={[
          { label: "Select", className: "w-[64px]" },
          { label: "Student", className: "w-[180px]" },
          { label: "Grade", className: "w-[110px]" },
          { label: "Current balance", className: "w-[135px]" },
          { label: "Last top-up", className: "w-[140px]" },
          { label: "Month spend", className: "w-[120px]" },
          { label: "Total top-ups", className: "w-[125px]" },
          { label: "Status", className: "w-[100px]" },
          ...(view === "archived" ? [{ label: "Archived", className: "w-[140px]" }] : []),
          { label: "Action", className: "w-[72px] text-center" },
        ]}
      >
        {pagination.pageRows.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={row.walletId}>
              <td>
                <label className="flex min-h-11 items-center" aria-label={`Select wallet for ${row.student}`}>
                  <input type="checkbox" checked={selectedSet.has(row.walletId)} onChange={() => toggleRow(row.walletId)} className="size-4 accent-[#e64a19]" />
                </label>
              </td>
              <td className="font-bold">{row.student}</td>
              <td>{row.grade}</td>
              <td className={row.status === "No balance" ? "font-bold text-[#9ba3b8]" : row.status === "Low" ? "font-bold text-[#f57c00]" : "font-bold text-[#e64a19]"}>{row.balance}</td>
              <td>{row.lastTopUp}</td>
              <td>{row.monthSpend}</td>
              <td>{row.totalTopUps}</td>
              <td><StatusPill tone={row.status === "Low" ? "low" : row.status === "No balance" ? "inactive" : "active"}>{row.status}</StatusPill></td>
              {view === "archived" ? <td className="font-mono text-[11px] text-[#5a6070]">{row.archivedAt ?? "Pending"}</td> : null}
              <td className="text-center">
                <button type="button" onClick={() => setConfirmationIds([row.walletId])} disabled={pending} className={iconButtonClass} aria-label={`${operationLabel} wallet for ${row.student}`} title={`${operationLabel} wallet`}>
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
          <section role="alertdialog" aria-modal="true" aria-labelledby="allowance-archive-title" className="relative w-full max-w-md rounded-xl border border-black/[0.07] bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-[#fff3e0] text-[#e65100]">
              {view === "archived" ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
            </div>
            <h3 id="allowance-archive-title" className="text-[16px] font-bold text-[#0f1117]">
              {operationLabel} {confirmationIds.length === 1 ? "this wallet" : `${confirmationIds.length} wallets`}?
            </h3>
            <p className="mt-2 text-[12.5px] leading-5 text-[#5a6070]">
              {view === "archived"
                ? "Restored wallets return to this school year's active Allowance ledger."
                : "Archiving only organizes this school year's admin ledger. The wallet stays usable, and balances, parent history, top-ups, purchases, KPIs, and reports remain unchanged."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmationIds([])} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button type="button" onClick={confirmAction} disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#e64a19] px-4 text-[12.5px] font-semibold text-white hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:opacity-60 sm:w-auto">
                {pending ? "Updating..." : `${operationLabel} wallets`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-[12.5px] font-semibold text-[#5a6070] transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-50";
const primaryDarkButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#0f1117] bg-[#0f1117] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#2d3348] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:pointer-events-none disabled:opacity-50";
const iconButtonClass = "inline-flex size-10 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:border-[#e64a19]/40 hover:bg-[#fff5f2] hover:text-[#e64a19] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:opacity-50";

function viewTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-md px-3 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
    active ? "bg-white text-[#0f1117] shadow-sm" : "text-[#5a6070] hover:text-[#0f1117]",
  );
}

function allowanceExportColumns(includeArchived: boolean): ExportColumn<AllowanceRow>[] {
  return [
    { label: "Student", value: (row) => row.student },
    { label: "Grade", value: (row) => row.grade },
    { label: "Current balance", value: (row) => row.balance },
    { label: "Last top-up", value: (row) => row.lastTopUp },
    { label: "Month spend", value: (row) => row.monthSpend },
    { label: "Total top-ups", value: (row) => row.totalTopUps },
    { label: "Status", value: (row) => row.status },
    ...(includeArchived ? [{ label: "Archived", value: (row: AllowanceRow) => row.archivedAt }] : []),
  ];
}

function emptyState(view: ArchiveView, hasRows: boolean, hasFilters: boolean) {
  if (hasRows && hasFilters) return "No wallet records match the current filters.";
  if (view === "archived") return "No archived allowance wallets yet.";
  return "No wallet records yet.";
}
