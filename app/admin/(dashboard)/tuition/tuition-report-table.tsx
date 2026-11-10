"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { CalendarDays, Eye, Pencil, ReceiptText, X } from "lucide-react";

import { saveTuitionTermsAction, updateTuitionAssignmentAction } from "@/app/admin/tuition-terms/actions";
import { TuitionTermScheduleFields } from "@/app/admin/fees/tuition-term-schedule-fields";
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
import { Button } from "@/components/ui/button";

import { AdminButton, AdminTable, StatusPill } from "../../_components/admin-ui";

export type TuitionReportRow = {
  assignmentId: number;
  recordSource: "assessment" | "legacy";
  assessmentId: number | null;
  packageName: string | null;
  batchReference: string | null;
  paymentPlanName: string | null;
  student: string;
  studentReference: string;
  grade: string;
  section: string;
  due: number;
  paid: number;
  balance: number;
  dueDate: string | null;
  nextDueDate: string | null;
  termStartDate: string;
  termEndDate: string | null;
  lastPayment: string;
  status: "paid" | "partial" | "unpaid";
  statusValue: "open" | "partial" | "paid" | "cancelled";
  termSummary: string;
  terms: Array<{
    id: number;
    name: string;
    amountDue: number;
    amountPaid: number;
    dueDate: string;
    status: string;
  }>;
};

type TuitionSort = "roster" | "balance_desc" | "due_asc" | "student_asc";

const tuitionSortOptions = [
  { label: "Grade then student name", value: "roster" },
  { label: "Highest balance", value: "balance_desc" },
  { label: "Nearest due date", value: "due_asc" },
  { label: "Student name A–Z", value: "student_asc" },
];

export function TuitionReportTable({
  rows,
  schoolName,
  schoolYearName,
}: {
  rows: TuitionReportRow[];
  schoolName: string;
  schoolYearName: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [sort, setSort] = useState<TuitionSort>("roster");
  const filteredRows = useMemo(() => {
    const matchingRows = filterByQuery(
      rows.filter((row) => (
        (status === "all" || row.status === status)
        && (grade === "all" || row.grade === grade)
        && (section === "all" || row.section === section)
      )),
      query,
      (row) => `${row.student} ${row.studentReference}`,
    );

    return sortTuitionRows(matchingRows, sort);
  }, [grade, query, rows, section, sort, status]);
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}|${grade}|${section}|${sort}`);
  const hasActiveFilters = query.trim().length > 0
    || status !== "all"
    || grade !== "all"
    || section !== "all"
    || sort !== "roster";
  const activeFilterCount = [status, grade, section].filter((value) => value !== "all").length
    + (sort === "roster" ? 0 : 1);
  const filteredTotals = useMemo(
    () => filteredRows.reduce(
      (totals, row) => ({
        due: totals.due + row.due,
        paid: totals.paid + row.paid,
        balance: totals.balance + row.balance,
      }),
      { due: 0, paid: 0, balance: 0 },
    ),
    [filteredRows],
  );
  const exportColumns: ExportColumn<TuitionReportRow>[] = [
    { label: "Student name", value: (row) => row.student },
    { label: "Student reference", value: (row) => row.studentReference },
    { label: "Grade", value: (row) => row.grade },
    { label: "Section", value: (row) => row.section },
    { label: "Billed", value: (row) => money(row.due) },
    { label: "Paid", value: (row) => money(row.paid) },
    { label: "Balance", value: (row) => money(row.balance) },
    { label: "Payment plan", value: (row) => paymentPlanLabel(row) },
    { label: "Due date", value: (row) => row.dueDate ?? "No due date" },
    { label: "Last payment", value: (row) => lastPaymentLabel(row.lastPayment) },
    { label: "Status", value: (row) => row.status },
  ];
  const exportOptions = {
    context: [
      { label: "School", value: schoolName },
      { label: "School year", value: schoolYearName },
    ],
    filters: [
      { label: "Search", value: query.trim() || "All students" },
      { label: "Status", value: filterLabel(status) },
      { label: "Grade", value: filterLabel(grade) },
      { label: "Section", value: filterLabel(section) },
      { label: "Sort", value: tuitionSortOptions.find((option) => option.value === sort)?.label ?? "Grade then student name" },
    ],
    summary: [
      { label: "Assignments", value: filteredRows.length },
      { label: "Total billed", value: money(filteredTotals.due) },
      { label: "Total paid", value: money(filteredTotals.paid) },
      { label: "Outstanding", value: money(filteredTotals.balance) },
    ],
  };
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setGrade("all");
    setSection("all");
    setSort("roster");
  };

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search student name or reference..."
          searchLabel="Search tuition records by student name or reference"
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Grade", value: grade, onChange: setGrade, options: toFilterOptions(rows.map((row) => row.grade), "All grades") },
            { label: "Section", value: section, onChange: setSection, options: toFilterOptions(rows.map((row) => row.section), "All sections") },
            { label: "Sort tuition records", value: sort, onChange: (value) => setSort(value as TuitionSort), options: tuitionSortOptions },
          ]}
          onClear={resetFilters}
          clearLabel="Reset filters"
          clearDisabled={!hasActiveFilters}
          onExport={() => exportRowsToExcel(
            "admin-tuition-report.xlsx",
            "Tuition balances",
            filteredRows,
            exportColumns,
            { worksheetName: "Tuition balances", ...exportOptions },
          )}
          onExportPdf={() => exportRowsToPdf(
            "admin-tuition-report.pdf",
            "Tuition balances",
            filteredRows,
            exportColumns,
            exportOptions,
          )}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredRows.length === 0}
          layout="compact"
          activeFilterCount={activeFilterCount}
          filterTitle="Filter tuition balances"
          filterDescription="Narrow the student balances or change their ordering."
        />
      </div>
      <AdminTable
        headers={[
          { label: "Student", className: "w-[20%]" },
          { label: "Billed", className: "w-[9%]" },
          { label: "Paid", className: "w-[9%]" },
          { label: "Balance", className: "w-[10%]" },
          { label: "Payment plan / due date", className: "w-[22%]" },
          { label: "Last payment", className: "w-[12%]" },
          { label: "Status", className: "w-[8%]" },
          { label: "Actions", className: "w-[10%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((row) => {
            const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);

            return (
              <tr key={row.assignmentId}>
                <td className="whitespace-normal">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{row.student}</p>
                    <p className="mt-1 truncate text-[11.5px] font-medium text-muted-foreground">
                      {row.studentReference} · {row.grade} - {row.section}
                    </p>
                  </div>
                </td>
                <td className="font-semibold text-foreground">P{row.due.toLocaleString()}</td>
                <td className="font-semibold text-status-success-foreground">P{row.paid.toLocaleString()}</td>
                <td className={row.balance > 0 ? "font-semibold text-status-danger-foreground" : "font-semibold text-muted-foreground"}>
                  P{row.balance.toLocaleString()}
                </td>
                <td className="whitespace-normal">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-foreground">{paymentPlanLabel(row)}</p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">{paymentPlanDetail(row)}</p>
                  </div>
                </td>
                <td className="font-mono text-[11px] text-muted-foreground">{lastPaymentLabel(row.lastPayment)}</td>
                <td>
                  <StatusPill tone={row.status}>{statusLabel}</StatusPill>
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1.5">
                    {row.recordSource === "assessment" ? (
                      <AssessmentDetailsModal row={row} />
                    ) : (
                      <>
                        <TuitionAssignmentEditModal row={row} />
                        <TuitionTermsModal row={row} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={8} className="text-center text-muted-foreground">
              {rows.length === 0 ? (
                "No tuition fee assignments yet."
              ) : (
                <div className="flex flex-col items-center gap-3 py-2">
                  <span>No tuition rows match the current filters.</span>
                  <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25">
                    Reset filters
                  </button>
                </div>
              )}
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

function filterLabel(value: string) {
  if (value === "all") return "All";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sortTuitionRows(rows: TuitionReportRow[], sort: TuitionSort) {
  if (sort === "roster") return rows;

  return [...rows].sort((left, right) => {
    if (sort === "balance_desc") {
      return right.balance - left.balance || left.student.localeCompare(right.student);
    }

    if (sort === "due_asc") {
      if (!left.dueDate && !right.dueDate) return left.student.localeCompare(right.student);
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return left.dueDate.localeCompare(right.dueDate) || left.student.localeCompare(right.student);
    }

    return left.student.localeCompare(right.student);
  });
}

function paymentPlanLabel(row: TuitionReportRow) {
  if (row.recordSource === "assessment") {
    return row.paymentPlanName ?? "Full payment";
  }

  return row.terms.length > 0 ? "Custom payment terms" : "Full payment";
}

function paymentPlanDetail(row: TuitionReportRow) {
  if (row.terms.length > 0) {
    const nextDue = row.nextDueDate ? ` · Next due ${displayDate(row.nextDueDate)}` : "";
    return `${row.termSummary}${nextDue}`;
  }

  return row.dueDate ? `Due ${displayDate(row.dueDate)}` : "No due date";
}

function lastPaymentLabel(value: string) {
  return value === "Pending" ? "No payment yet" : value;
}

function AssessmentDetailsModal({ row }: { row: TuitionReportRow }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        size="icon-sm"
        title={`View assessment for ${row.student}`}
        aria-label={`View tuition assessment for ${row.student}`}
      >
        <Eye />
      </Button>

      {open ? (
        <div className="portal-dialog-backdrop fixed inset-0 z-[200] grid place-items-center overflow-y-auto px-3 py-6 sm:px-6">
          <button
            type="button"
            aria-label="Close assessment details dialog"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[calc(100svh-48px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 id={titleId} className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ReceiptText className="size-4 text-primary" />
                  Tuition assessment
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {row.student} · {row.studentReference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5">
              <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg p-3 text-sm leading-5 text-status-info-foreground">
                This schedule comes from the approved tuition package. To protect posted financial records, it cannot be replaced with manual row-level terms.
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <AssessmentSummary label="Tuition package" value={row.packageName ?? "Approved package"} />
                <AssessmentSummary label="Payment arrangement" value={paymentPlanLabel(row)} />
                <AssessmentSummary label="Tuition billed" value={money(row.due)} />
                <AssessmentSummary label="Remaining tuition balance" value={money(row.balance)} />
              </dl>

              <div className="mt-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Approved payment schedule</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{row.termSummary}</p>
                  </div>
                  {row.batchReference ? (
                    <Link
                      href={`/admin/tuition/assessments/${encodeURIComponent(row.batchReference)}`}
                      className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      Batch {row.batchReference}
                    </Link>
                  ) : null}
                </div>

                {row.terms.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {row.terms.map((term) => {
                      const termBalance = Math.max(term.amountDue - term.amountPaid, 0);

                      return (
                        <div key={term.id} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{term.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Due {displayDate(term.dueDate)} · {term.status}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground">Scheduled</p>
                            <p className="font-semibold text-foreground">{money(term.amountDue)}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground">Remaining</p>
                            <p className={termBalance > 0 ? "font-semibold text-status-danger-foreground" : "font-semibold text-status-success-foreground"}>{money(termBalance)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Full payment is due {row.dueDate ? `on ${displayDate(row.dueDate)}` : "on the package deadline"}.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-border px-4 py-3.5 sm:px-5">
              <AdminButton type="button" tone="primary" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                Done
              </AdminButton>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AssessmentSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function displayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function TuitionAssignmentEditModal({ row }: { row: TuitionReportRow }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const hasTerms = row.terms.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        size="icon-sm"
        title={`Edit assignment for ${row.student}`}
        aria-label={`Edit tuition assignment for ${row.student}`}
      >
        <Pencil />
      </Button>

      {open ? (
        <div className="portal-dialog-backdrop fixed inset-0 z-[200] grid place-items-center overflow-y-auto px-3 py-6 sm:px-6">
          <button
            type="button"
            aria-label="Close tuition edit dialog"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[calc(100svh-48px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
              <div>
                <h2 id={titleId} className="flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
                  <Pencil className="size-4 text-[#e64a19]" />
                  Edit tuition assignment
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-[#5a6070]">
                  Update {row.student}&apos;s tuition report details. The fee due date is the official parent deadline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={updateTuitionAssignmentAction} className="overflow-y-auto">
              <input type="hidden" name="assignmentId" value={row.assignmentId} />
              <div className="grid gap-4 p-4 sm:p-5">
                <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
                  Amount due
                  {hasTerms ? (
                    <>
                      <input type="hidden" name="amountDue" value={row.due} />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.due}
                        disabled
                        className="min-h-12 rounded-lg border border-black/10 bg-[#f2f4f7] px-3 text-[14px] font-semibold normal-case tracking-normal text-[#5a6070] outline-none"
                      />
                    </>
                  ) : (
                    <input
                      name="amountDue"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={row.due}
                      className="min-h-12 rounded-lg border border-black/10 bg-white px-3 text-[14px] font-semibold normal-case tracking-normal text-[#0f1117] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/15"
                      required
                    />
                  )}
                  <span className="text-[11.5px] font-medium normal-case leading-5 tracking-normal text-[#5a6070]">
                    {hasTerms ? "Amount is locked while terms exist. Use Manage terms to control the schedule." : "Amount cannot be lower than the amount already paid."}
                  </span>
                </label>

                <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
                  {hasTerms ? "Overall due date" : "Fee due date"}
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={row.dueDate ?? ""}
                    className="min-h-12 rounded-lg border border-black/10 bg-white px-3 text-[14px] normal-case tracking-normal text-[#0f1117] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/15"
                  />
                  <span className="text-[11.5px] font-medium normal-case leading-5 tracking-normal text-[#5a6070]">
                    {hasTerms ? "Official parent deadline. Term dates must be on or before this date." : "This is the parent payment deadline."}
                  </span>
                </label>

                <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
                  Status
                  <select
                    name="status"
                    defaultValue={row.statusValue}
                    className="min-h-12 rounded-lg border border-black/10 bg-white px-3 text-[14px] normal-case tracking-normal text-[#0f1117] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/15"
                    required
                  >
                    <option value="open">Open</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] px-4 py-3.5 sm:flex-row sm:justify-end sm:px-5">
                <AdminButton type="button" tone="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                  Cancel
                </AdminButton>
                <AdminButton type="submit" tone="primary" className="w-full sm:w-auto">
                  Save changes
                </AdminButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function TuitionTermsModal({ row }: { row: TuitionReportRow }) {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState(() => initialTerms(row));
  const titleId = useId();
  const remainingBalance = row.balance;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setTerms(initialTerms(row));
          setOpen(true);
        }}
        variant="outline"
        size="icon-sm"
        title={`Manage terms for ${row.student}`}
        aria-label={`Manage tuition terms for ${row.student}`}
      >
        <CalendarDays />
      </Button>

      {open ? (
        <div className="portal-dialog-backdrop fixed inset-0 z-[200] grid place-items-center overflow-y-auto px-3 py-6 sm:px-6">
          <button
            type="button"
            aria-label="Close tuition terms dialog"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[calc(100svh-48px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
              <div>
                <h2 id={titleId} className="flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
                  <CalendarDays className="size-4 text-[#e64a19]" />
                  Manage tuition terms
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-[#5a6070]">
                  Split {row.student}&apos;s remaining balance of {money(remainingBalance)} into scheduled due dates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={saveTuitionTermsAction} className="overflow-y-auto">
              <input type="hidden" name="assignmentId" value={row.assignmentId} />
              <div className="space-y-4 p-4 sm:p-5">
                <TuitionTermScheduleFields
                  totalAmount={remainingBalance}
                  initialTerms={terms}
                  defaultTermCount={row.terms.length > 0 ? 0 : 3}
                  earliestDueDate={row.termStartDate}
                  latestDueDate={row.termEndDate}
                  title="Student payment terms"
                  emptyText="No terms yet."
                  addLabel="Add term"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] px-4 py-3.5 sm:flex-row sm:justify-end sm:px-5">
                <AdminButton type="button" tone="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                  Cancel
                </AdminButton>
                <AdminButton
                  type="submit"
                  tone="primary"
                  className="w-full sm:w-auto"
                  disabled={!validDateWindow(row.termStartDate, row.termEndDate)}
                >
                  Save terms
                </AdminButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

type EditableTerm = {
  key: string;
  name: string;
  amount: string;
  dueDate: string;
};

function initialTerms(row: TuitionReportRow): EditableTerm[] {
  if (row.terms.length > 0) {
    return row.terms.map((term) => ({
      key: String(term.id),
      name: term.name,
      amount: String(term.amountDue),
      dueDate: term.dueDate,
    }));
  }

  const split = splitAmount(row.balance, 3);

  return split.map((amount, index) => ({
    key: `new-${index}`,
    name: `Term ${index + 1}`,
    amount: String(amount),
    dueDate: "",
  }));
}

function splitAmount(total: number, parts: number) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  let remainder = cents - base * parts;

  return Array.from({ length: parts }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return value / 100;
  });
}

function validDateWindow(startDate: string, endDate: string | null) {
  return Boolean(endDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && startDate <= endDate);
}

function money(value: number) {
  return `P${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
