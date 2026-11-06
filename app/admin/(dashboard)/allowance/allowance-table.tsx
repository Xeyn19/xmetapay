"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, X } from "lucide-react";
import { toast } from "sonner";

import {
  DashboardTableControls,
  DashboardTablePagination,
  type ExportColumn,
  exportRowsToExcel,
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
import { readableDisabledControlClass } from "@/lib/ui/control-styles";
import { cn } from "@/lib/utils";

import { AdminTable, StatusPill } from "../../_components/admin-ui";

export type AllowanceRow = AdminAllowanceDisplayRow;

type WalletStatusFilter = "all" | "Active" | "Low" | "No balance";
type ArchiveView = "active" | "archived";

const initialActionState: AllowanceArchiveActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

const statusFilterOptions: Array<{ label: string; value: WalletStatusFilter }> = [
  { label: "All students", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Low balance", value: "Low" },
  { label: "Zero balance", value: "No balance" },
];

export function AllowanceTable({
  activeRows,
  archivedRows,
  schoolName,
  schoolYearName,
}: {
  activeRows: AllowanceRow[];
  archivedRows: AllowanceRow[];
  schoolName: string;
  schoolYearName: string;
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
  const somePageRowsSelected = pageIds.some((id) => selectedSet.has(id));
  const selectAllVisibleRef = useRef<HTMLInputElement>(null);
  const exportColumns = allowanceExportColumns(view === "archived");
  const exportTitle = view === "archived" ? "Archived allowance wallets" : "Active allowance wallets";
  const hasActiveFilters = query.trim() !== "" || status !== "all";
  const activeFilterCount = status === "all" ? 0 : 1;
  const exportOptions = {
    context: [
      { label: "School", value: schoolName },
      { label: "School year", value: schoolYearName },
      { label: "View", value: view === "archived" ? "Archived wallets" : "Active wallets" },
    ],
    filters: [
      { label: "Search", value: query.trim() || "All wallets" },
      { label: "Status", value: status === "all" ? "All" : status },
    ],
    summary: [
      { label: "Wallets", value: filteredRows.length },
      { label: "Current balance", value: money(filteredRows.reduce((total, row) => total + parseMoney(row.balance), 0)) },
      { label: "Month spend", value: money(filteredRows.reduce((total, row) => total + parseMoney(row.monthSpend), 0)) },
      { label: "Total top-ups", value: money(filteredRows.reduce((total, row) => total + parseMoney(row.totalTopUps), 0)) },
    ],
  };

  const changeView = (nextView: ArchiveView) => {
    setView(nextView);
    setQuery("");
    setStatus("all");
    setSelectedIds([]);
    setConfirmationIds([]);
  };
  const clearSelectionState = () => {
    setSelectedIds([]);
    setConfirmationIds([]);
  };
  const changeQuery = (value: string) => {
    setQuery(value);
    clearSelectionState();
  };
  const changeStatus = (value: WalletStatusFilter) => {
    setStatus(value);
    clearSelectionState();
  };
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    clearSelectionState();
  };

  const toggleRow = (walletId: number) => {
    setSelectedIds((current) => current.includes(walletId)
      ? current.filter((id) => id !== walletId)
      : [...current, walletId]);
  };
  const toggleVisible = () => {
    setSelectedIds((current) => allPageRowsSelected
      ? current.filter((id) => !pageIds.includes(id))
      : [...new Set([...current, ...pageIds])]);
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

  useEffect(() => {
    if (selectAllVisibleRef.current) {
      selectAllVisibleRef.current.indeterminate = somePageRowsSelected && !allPageRowsSelected;
    }
  }, [allPageRowsSelected, somePageRowsSelected]);

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3.5 sm:px-[18px]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="inline-flex min-h-11 rounded-lg border border-border bg-muted p-1" role="tablist" aria-label="Allowance ledger archive view">
            <button type="button" role="tab" aria-selected={view === "active"} onClick={() => changeView("active")} className={viewTabClass(view === "active")}>
              Active wallets ({activeWalletRows.length})
            </button>
            <button type="button" role="tab" aria-selected={view === "archived"} onClick={() => changeView("archived")} className={viewTabClass(view === "archived")}>
              Archived wallets ({archivedWalletRows.length})
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <DashboardTableControls
              query={query}
              onQueryChange={changeQuery}
              searchPlaceholder="Search wallets..."
              searchLabel="Search allowance wallets by student, grade, or status"
              filters={[
                { label: "Wallet status", value: status, onChange: (value) => changeStatus(value as WalletStatusFilter), options: statusFilterOptions },
              ]}
              onClear={resetFilters}
              clearLabel="Reset filters"
              clearDisabled={!hasActiveFilters}
              onExport={() => exportRowsToExcel(
                view === "archived" ? "admin-allowance-wallets-archived.xlsx" : "admin-allowance-wallets.xlsx",
                exportTitle,
                filteredRows,
                exportColumns,
                {
                  worksheetName: view === "archived" ? "Archived allowance" : "Active allowance",
                  ...exportOptions,
                },
              )}
              onExportPdf={() => exportRowsToPdf(
                view === "archived" ? "admin-allowance-wallets-archived.pdf" : "admin-allowance-wallets.pdf",
                exportTitle,
                filteredRows,
                exportColumns,
                exportOptions,
              )}
              exportLabel="Export Excel"
              exportingLabel="Generating Excel..."
              exportDisabled={filteredRows.length === 0}
              layout="compact"
              activeFilterCount={activeFilterCount}
              filterTitle="Filter allowance wallets"
              filterDescription="Focus on active, low-balance, or zero-balance wallets."
            />
          </div>
        </div>

        {validSelectedIds.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-button-soft px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <span className="text-xs font-semibold text-foreground" aria-live="polite">
              {validSelectedIds.length} {validSelectedIds.length === 1 ? "wallet" : "wallets"} selected
            </span>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button type="button" onClick={() => setSelectedIds([])} className={secondaryButtonClass}>
                <X className="size-4" /> Clear
              </button>
              <button type="button" onClick={() => setConfirmationIds(validSelectedIds)} disabled={pending} className={primaryDarkButtonClass}>
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
                aria-label="Select all visible allowance wallets"
                className="size-4 accent-primary"
              />
            ),
            className: "w-[64px]",
          },
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
                  <input type="checkbox" checked={selectedSet.has(row.walletId)} onChange={() => toggleRow(row.walletId)} className="size-4 accent-primary" />
                </label>
              </td>
              <td className="font-bold">{row.student}</td>
              <td>{row.grade}</td>
              <td className={row.status === "No balance" ? "font-bold text-muted-foreground" : row.status === "Low" ? "font-bold text-status-warning-foreground" : "font-bold text-primary"}>{row.balance}</td>
              <td>{row.lastTopUp}</td>
              <td>{row.monthSpend}</td>
              <td>{row.totalTopUps}</td>
              <td><StatusPill tone={row.status === "Low" ? "low" : row.status === "No balance" ? "inactive" : "active"}>{row.status}</StatusPill></td>
              {view === "archived" ? <td className="font-mono text-[11px] text-muted-foreground">{row.archivedAt ?? "Pending"}</td> : null}
              <td className="text-center">
                <button type="button" onClick={() => setConfirmationIds([row.walletId])} disabled={pending} className={iconButtonClass} aria-label={`${operationLabel} wallet for ${row.student}`} title={`${operationLabel} wallet`}>
                  {view === "archived" ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={view === "archived" ? 10 : 9} className="py-8 text-center text-muted-foreground">
              {hasFilters ? <span>{emptyState(view, hasRows, hasFilters)} <button type="button" onClick={resetFilters} className="ml-1 min-h-11 font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reset filters</button></span> : emptyState(view, hasRows, hasFilters)}
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
        <div className="fixed inset-0 z-[220] grid place-items-center bg-foreground/45 px-4 py-6 backdrop-blur-sm">
          <button type="button" className="fixed inset-0 cursor-default" onClick={() => setConfirmationIds([])} aria-label="Close confirmation" />
          <section role="alertdialog" aria-modal="true" aria-labelledby="allowance-archive-title" className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl sm:p-6">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-status-warning-bg text-status-warning-foreground">
              {view === "archived" ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
            </div>
            <h3 id="allowance-archive-title" className="text-[16px] font-bold text-foreground">
              {operationLabel} {confirmationIds.length === 1 ? "this wallet" : `${confirmationIds.length} wallets`}?
            </h3>
            <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
              {view === "archived"
                ? "Restored wallets return to this school year's active Allowance ledger."
                : "Archiving only organizes this school year's admin ledger. The wallet stays usable, and balances, parent history, top-ups, purchases, KPIs, and reports remain unchanged."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmationIds([])} className={cn(secondaryButtonClass, "w-full sm:w-auto")}>Cancel</button>
              <button type="button" onClick={confirmAction} disabled={pending} className={cn("inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:w-auto", readableDisabledControlClass)}>
                {pending ? "Updating..." : `${operationLabel} wallets`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

const secondaryButtonClass = cn("inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50", readableDisabledControlClass);
const primaryDarkButtonClass = cn("inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-button-secondary bg-button-secondary px-3.5 text-[12.5px] font-semibold text-button-secondary-foreground transition hover:bg-button-secondary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50", readableDisabledControlClass);
const iconButtonClass = cn("inline-flex size-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:bg-button-soft hover:text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25", readableDisabledControlClass);

function viewTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-md px-3 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
}

function parseMoney(value: string) {
  const parsed = Number(value.replaceAll(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return `P${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
