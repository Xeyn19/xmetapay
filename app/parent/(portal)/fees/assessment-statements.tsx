import { CalendarClock, ChevronDown, ReceiptText } from "lucide-react";

import type { ParentAssessmentStatement } from "@/lib/fees/assessment-workflow";

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export function AssessmentStatements({ statements }: { statements: ParentAssessmentStatement[] }) {
  if (!statements.length) return null;

  return (
    <section className="mb-5 space-y-3" aria-labelledby="assessment-statements">
      <div>
        <h2 id="assessment-statements" className="text-lg font-semibold text-foreground">Statements of Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Open a statement to review its charges, credits, and scheduled payments.</p>
      </div>
      {statements.map((statement) => {
        const unpaidTerms = [...statement.terms].filter((term) => term.balance > 0).sort((left, right) => left.dueDate.localeCompare(right.dueDate));
        const nextTerm = unpaidTerms[0];
        const planLabel = statement.terms.length > 0 ? `${statement.terms.length} scheduled payment${statement.terms.length === 1 ? "" : "s"}` : "Full payment or upfront charges";

        return (
          <details key={statement.id} className="group overflow-hidden rounded-xl border border-border bg-card">
            <summary className="flex min-h-20 cursor-pointer list-none flex-col gap-3 p-4 outline-none transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ReceiptText className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{statement.studentName} · {statement.scheduleName}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{statement.periodName} · {statement.reference}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{nextTerm ? `Next: ${nextTerm.name}, due ${nextTerm.dueDate}` : planLabel}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                <span className="text-left sm:text-right"><span className="block text-xs text-muted-foreground">Outstanding balance</span><strong className="block text-lg text-primary">{peso(statement.balance)}</strong></span>
                <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="border-t border-border">
              <div className="grid gap-5 p-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Itemized charges</h3>
                  <div className="mt-3 space-y-3">{statement.charges.map((charge, index) => (
                    <div key={`${charge.name}-${index}`} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 text-foreground">{charge.name}<small className="block text-muted-foreground">{charge.timing === "upfront" ? "Due separately" : "Included in the payment plan"}</small></span>
                      <span className="shrink-0 text-right font-medium text-foreground">{peso(charge.net)}{charge.credit ? <small className="block text-emerald-600">−{peso(charge.credit)} credit</small> : null}</span>
                    </div>
                  ))}</div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Payment schedule</h3>
                  <div className="mt-3 space-y-3">{statement.terms.length ? statement.terms.map((term, index) => (
                    <div key={`${term.name}-${index}`} className="flex justify-between gap-3 text-sm">
                      <span className="text-foreground">{term.name}<small className="block text-muted-foreground">Due {term.dueDate}</small></span>
                      <span className="shrink-0 text-right font-medium text-foreground">{peso(term.balance)}<small className="block text-muted-foreground">remaining</small></span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No installment schedule. Individual due dates are available in fee records below.</p>}</div>
                </div>
              </div>
              <footer className="grid grid-cols-2 gap-3 bg-muted/50 p-4 text-sm sm:grid-cols-4">
                <span className="text-muted-foreground">Gross <strong className="block text-foreground">{peso(statement.gross)}</strong></span>
                <span className="text-muted-foreground">Credits <strong className="block text-emerald-600">{peso(statement.credits)}</strong></span>
                <span className="text-muted-foreground">Paid <strong className="block text-foreground">{peso(statement.paid)}</strong></span>
                <span className="text-muted-foreground">Net <strong className="block text-foreground">{peso(statement.net)}</strong></span>
              </footer>
            </div>
          </details>
        );
      })}
    </section>
  );
}
