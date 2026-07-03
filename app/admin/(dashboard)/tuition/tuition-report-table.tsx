"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarDays, Plus, X } from "lucide-react";

import { saveTuitionTermsAction } from "@/app/admin/tuition-terms/actions";
import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";

import { AdminButton, AdminTable, Field, StatusPill, fieldControlClass } from "../../_components/admin-ui";

export type TuitionReportRow = {
  assignmentId: number;
  student: string;
  grade: string;
  section: string;
  due: number;
  paid: number;
  balance: number;
  lastPayment: string;
  status: "paid" | "partial" | "unpaid";
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

export function TuitionReportTable({ rows }: { rows: TuitionReportRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [grade, setGrade] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => (status === "all" || row.status === status) && (grade === "all" || row.grade === grade)),
      query,
      (row) => `${row.student} ${row.grade} ${row.section} ${row.lastPayment} ${row.status}`,
    ),
    [grade, query, rows, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}|${grade}`);

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search student, grade..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "Grade", value: grade, onChange: setGrade, options: toFilterOptions(rows.map((row) => row.grade), "All grades") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setGrade("all");
          }}
          onExport={() => exportRowsToCsv("admin-tuition-report.csv", filteredRows, [
            { label: "Student name", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Section", value: (row) => row.section },
            { label: "Fee due", value: (row) => row.due },
            { label: "Paid", value: (row) => row.paid },
            { label: "Balance", value: (row) => row.balance },
            { label: "Last payment", value: (row) => row.lastPayment },
            { label: "Status", value: (row) => row.status },
            { label: "Terms", value: (row) => row.termSummary },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-tuition-report.pdf", "Tuition report", filteredRows, [
            { label: "Student name", value: (row) => row.student },
            { label: "Grade", value: (row) => row.grade },
            { label: "Section", value: (row) => row.section },
            { label: "Fee due", value: (row) => row.due },
            { label: "Paid", value: (row) => row.paid },
            { label: "Balance", value: (row) => row.balance },
            { label: "Last payment", value: (row) => row.lastPayment },
            { label: "Status", value: (row) => row.status },
            { label: "Terms", value: (row) => row.termSummary },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <AdminTable
        headers={[
          { label: "Student name", className: "w-[20%]" },
          { label: "Grade", className: "w-[10%]" },
          { label: "Section", className: "w-[10%]" },
          { label: "Fee due", className: "w-[12%]" },
          { label: "Paid", className: "w-[11%]" },
          { label: "Balance", className: "w-[11%]" },
          { label: "Last payment", className: "w-[12%]" },
          { label: "Status", className: "w-[10%]" },
          { label: "Terms", className: "w-[12%]" },
          { label: "Action", className: "w-[10%]" },
        ]}
      >
        {filteredRows.length > 0 ? (
          pagination.pageRows.map((row) => {
            const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);

            return (
              <tr key={row.assignmentId}>
                <td className="font-bold">{row.student}</td>
                <td>{row.grade}</td>
                <td>{row.section}</td>
                <td>P{row.due.toLocaleString()}</td>
                <td className="font-semibold text-[#2e7d32]">P{row.paid.toLocaleString()}</td>
                <td className={row.balance > 0 ? "font-semibold text-[#c62828]" : "text-[#9ba3b8]"}>
                  P{row.balance.toLocaleString()}
                </td>
                <td className="font-mono text-[11px] text-[#5a6070]">{row.lastPayment}</td>
                <td>
                  <StatusPill tone={row.status}>{statusLabel}</StatusPill>
                </td>
                <td className="text-[12px] font-semibold text-[#5a6070]">{row.termSummary}</td>
                <td>
                  <TuitionTermsModal row={row} />
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={10} className="text-center text-[#5a6070]">
              {rows.length === 0 ? "No tuition fee assignments yet." : "No tuition rows match the current filters."}
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

function TuitionTermsModal({ row }: { row: TuitionReportRow }) {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState(() => initialTerms(row));
  const titleId = useId();
  const remainingBalance = row.balance;
  const termTotal = terms.reduce((sum, term) => sum + Number(term.amount || 0), 0);

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
      <button
        type="button"
        onClick={() => {
          setTerms(initialTerms(row));
          setOpen(true);
        }}
        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#0f1117] transition hover:border-[#e64a19]/35 hover:bg-[#fff5f2] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
      >
        Manage terms
      </button>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
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
                <div className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3 text-[12.5px] leading-5 text-[#5a6070]">
                  Term total must equal the remaining tuition balance. Current term total:{" "}
                  <span className={Math.round(termTotal * 100) === Math.round(remainingBalance * 100) ? "font-bold text-[#2e7d32]" : "font-bold text-[#c62828]"}>
                    {money(termTotal)}
                  </span>
                </div>

                <div className="grid gap-3">
                  {terms.map((term, index) => (
                    <div key={term.key} className="grid gap-3 rounded-lg border border-black/[0.07] bg-white p-3 min-[720px]:grid-cols-[1fr_150px_170px_44px]">
                      <Field label={`Term ${index + 1} name`} required>
                        <input
                          name="termName"
                          value={term.name}
                          onChange={(event) => updateTerm(setTerms, term.key, "name", event.target.value)}
                          className={fieldControlClass}
                          required
                        />
                      </Field>
                      <Field label="Amount" required>
                        <input
                          name="termAmount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={term.amount}
                          onChange={(event) => updateTerm(setTerms, term.key, "amount", event.target.value)}
                          className={fieldControlClass}
                          required
                        />
                      </Field>
                      <Field label="Due date" required>
                        <input
                          name="termDueDate"
                          type="date"
                          value={term.dueDate}
                          onChange={(event) => updateTerm(setTerms, term.key, "dueDate", event.target.value)}
                          className={fieldControlClass}
                          required
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => setTerms((current) => rebalanceTerms(current.filter((item) => item.key !== term.key), remainingBalance))}
                        className="mt-auto inline-flex min-h-12 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                        aria-label={`Remove ${term.name}`}
                        disabled={terms.length === 1}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setTerms((current) => rebalanceTerms([...current, blankTerm(current.length)], remainingBalance))}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3.5 text-[12.5px] font-semibold text-[#0f1117] transition hover:border-[#e64a19]/35 hover:bg-[#fff5f2] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                >
                  <Plus className="size-4" />
                  Add term
                </button>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] px-4 py-3.5 sm:flex-row sm:justify-end sm:px-5">
                <AdminButton type="button" tone="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                  Cancel
                </AdminButton>
                <AdminButton type="submit" tone="primary" className="w-full sm:w-auto">
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

function blankTerm(index: number): EditableTerm {
  return {
    key: `new-${Date.now()}-${index}`,
    name: `Term ${index + 1}`,
    amount: "",
    dueDate: "",
  };
}

function rebalanceTerms(terms: EditableTerm[], total: number): EditableTerm[] {
  const split = splitAmount(total, Math.max(terms.length, 1));

  return terms.map((term, index) => ({
    ...term,
    amount: String(split[index] ?? 0),
  }));
}

function updateTerm(
  setTerms: (updater: (current: EditableTerm[]) => EditableTerm[]) => void,
  key: string,
  field: keyof Omit<EditableTerm, "key">,
  value: string,
) {
  setTerms((current) => current.map((term) => (term.key === key ? { ...term, [field]: value } : term)));
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

function money(value: number) {
  return `P${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
