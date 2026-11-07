import { CalendarClock, CheckCircle2, ChevronDown, CircleDollarSign, ReceiptText } from "lucide-react";

import type { ParentAssessmentStatement, ParentStatementLineStatus, ParentStatementStatus } from "@/lib/fees/assessment-workflow";

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const date = (value: string) => value ? new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${value}T00:00:00+08:00`)) : "Date unavailable";

const statementStatuses: Record<ParentStatementStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-secondary text-secondary-foreground" },
  payment_due: { label: "Payment due", className: "bg-muted text-foreground" },
  partial: { label: "Partially paid", className: "bg-primary/10 text-primary" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive" },
};

const lineStatuses: Record<ParentStatementLineStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-secondary text-secondary-foreground" },
  partial: { label: "Partially paid", className: "bg-primary/10 text-primary" },
  upcoming: { label: "Upcoming", className: "bg-muted text-muted-foreground" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive" },
};

export function AssessmentStatements({ statements }: { statements: ParentAssessmentStatement[] }) {
  if (!statements.length) return null;

  const unpaidStatements = statements.filter((statement) => statement.balance > 0);
  const paidStatements = statements.filter((statement) => statement.balance <= 0);

  return (
    <section className="mb-5 space-y-3" aria-labelledby="assessment-statements">
      <div>
        <h2 id="assessment-statements" className="text-lg font-semibold text-foreground">Statements of Account</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">See what is due next, track payment progress, and open a statement only when you need the complete breakdown.</p>
      </div>

      {unpaidStatements.map((statement) => <StatementCard key={statement.id} statement={statement} />)}

      {paidStatements.length > 0 ? (
        <details className="group/history overflow-hidden rounded-xl border border-border bg-card">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <CheckCircle2 className="size-5 shrink-0 text-secondary-foreground" />
              <span>
                <span className="block text-sm font-semibold text-foreground">Paid statements</span>
                <span className="block text-xs text-muted-foreground">{paidStatements.length} completed statement{paidStatements.length === 1 ? "" : "s"}</span>
              </span>
            </span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open/history:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-3 border-t border-border bg-muted/30 p-3 sm:p-4">
            {paidStatements.map((statement) => <StatementCard key={statement.id} statement={statement} />)}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function StatementCard({ statement }: { statement: ParentAssessmentStatement }) {
  const status = statementStatuses[statement.displayStatus];
  const fullPaymentDate = statement.charges.find((charge) => charge.balance > 0)?.dueDate ?? statement.charges[0]?.dueDate ?? "";
  const fullPaymentStatus: ParentStatementLineStatus = statement.displayStatus === "paid" ? "paid" : statement.displayStatus === "overdue" ? "overdue" : statement.displayStatus === "partial" ? "partial" : "upcoming";

  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-card">
      <summary className="min-h-20 cursor-pointer list-none p-4 outline-none transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ReceiptText className="size-5" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted-foreground">{statement.studentName}</span>
              <span className="mt-0.5 block text-sm font-semibold text-foreground sm:text-base">{statement.scheduleName}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{statement.periodName}</span>
            </span>
          </span>
          <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
        </span>

        <span className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1.35fr_1fr]">
          <span>
            <span className="block text-xs text-muted-foreground">Outstanding balance</span>
            <strong className={`mt-0.5 block text-lg ${statement.balance > 0 ? "text-primary" : "text-foreground"}`}>{peso(statement.balance)}</strong>
          </span>
          <span>
            <span className="block text-xs text-muted-foreground">Next payment</span>
            {statement.nextPayment ? (
              <span className="mt-0.5 block text-sm font-semibold text-foreground">{peso(statement.nextPayment.amount)} <small className="font-normal text-muted-foreground">· {statement.nextPayment.name}, due {date(statement.nextPayment.dueDate)}</small></span>
            ) : <span className="mt-0.5 block text-sm font-semibold text-foreground">No payment remaining</span>}
          </span>
          <span className="flex items-end justify-between gap-3 sm:block sm:text-right">
            <span><span className="block text-xs text-muted-foreground">Payment plan</span><span className="mt-0.5 block text-sm font-semibold text-foreground">{statement.paymentPlanLabel}</span></span>
            <span className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary sm:min-h-0 sm:justify-end">
              <span className="group-open:hidden">View statement details</span><span className="hidden group-open:inline">Hide statement details</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </span>
        </span>
      </summary>

      <div className="border-t border-border">
        <section className="p-4 sm:p-5" aria-label="Payment progress">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-foreground">Payment progress</h3><p className="mt-0.5 text-xs text-muted-foreground">{statement.progressPercent}% of the net tuition has been paid.</p></div>
            <strong className="text-sm text-foreground">{peso(statement.paid)} paid</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Tuition payment progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={statement.progressPercent}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${statement.progressPercent}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <span className="text-muted-foreground">Net billed<strong className="mt-0.5 block text-foreground">{peso(statement.net)}</strong></span>
            <span className="text-muted-foreground">Paid<strong className="mt-0.5 block text-foreground">{peso(statement.paid)}</strong></span>
            <span className="text-muted-foreground">Remaining<strong className="mt-0.5 block text-primary">{peso(statement.balance)}</strong></span>
          </div>
        </section>

        {statement.nextPayment ? (
          <section className="border-t border-border bg-primary/5 p-4 sm:p-5" aria-label="Next payment due">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="size-4" /></span>
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Next payment</p><p className="mt-1 text-base font-semibold text-foreground">{statement.nextPayment.name} · {peso(statement.nextPayment.amount)}</p><p className="mt-1 text-sm text-muted-foreground">Due {date(statement.nextPayment.dueDate)}</p></div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-border p-4 sm:p-5" aria-label="Payment schedule">
          <div className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Payment schedule</h3></div>
          <div className="mt-3 space-y-2">
            {statement.terms.length > 0 ? statement.terms.map((term) => (
              <ScheduleRow key={`${statement.id}-term-${term.sortOrder}`} name={term.name} dueDate={term.dueDate} amount={term.due} paid={term.paid} balance={term.balance} status={term.displayStatus} />
            )) : (
              <ScheduleRow name="Full payment" dueDate={fullPaymentDate} amount={statement.net} paid={statement.paid} balance={statement.balance} status={fullPaymentStatus} />
            )}
          </div>
        </section>

        <details className="group/breakdown border-t border-border">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><CircleDollarSign className="size-4 text-primary" />Charge and credit breakdown</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/breakdown:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-border bg-muted/30 p-4 sm:p-5">
            <div className="space-y-3">
              {statement.charges.map((charge) => (
                <div key={`${statement.id}-charge-${charge.sortOrder}`} className="grid gap-1 text-sm sm:grid-cols-[1fr_auto] sm:gap-4">
                  <span className="text-foreground">{charge.name}<small className="mt-0.5 block text-muted-foreground">{charge.timing === "upfront" ? "Paid separately" : "Included in the payment plan"}{charge.dueDate ? ` · Due ${date(charge.dueDate)}` : ""}</small></span>
                  <span className="font-semibold text-foreground sm:text-right">{peso(charge.net)}{charge.credit > 0 ? <small className="mt-0.5 block font-normal text-primary">{peso(charge.credit)} credit applied</small> : null}</span>
                </div>
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Gross charges</dt><dd className="mt-0.5 font-semibold text-foreground">{peso(statement.gross)}</dd></div>
              {statement.credits > 0 ? <div><dt className="text-muted-foreground">Credits</dt><dd className="mt-0.5 font-semibold text-primary">−{peso(statement.credits)}</dd></div> : null}
              <div><dt className="text-muted-foreground">Net tuition billed</dt><dd className="mt-0.5 font-semibold text-foreground">{peso(statement.net)}</dd></div>
            </dl>
            <p className="mt-4 break-all text-xs text-muted-foreground">Statement reference: {statement.reference}</p>
          </div>
        </details>
      </div>
    </details>
  );
}

function ScheduleRow({ name, dueDate, amount, paid, balance, status }: { name: string; dueDate: string; amount: number; paid: number; balance: number; status: ParentStatementLineStatus }) {
  const presentation = lineStatuses[status];
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-sm font-semibold text-foreground">{name}</p><p className="mt-0.5 text-xs text-muted-foreground">Due {date(dueDate)}</p></div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${presentation.className}`}>{presentation.label}</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
        <div><dt className="text-muted-foreground">Amount</dt><dd className="mt-0.5 font-semibold text-foreground">{peso(amount)}</dd></div>
        <div><dt className="text-muted-foreground">Paid</dt><dd className="mt-0.5 font-semibold text-foreground">{peso(paid)}</dd></div>
        <div><dt className="text-muted-foreground">Remaining</dt><dd className="mt-0.5 font-semibold text-foreground">{peso(balance)}</dd></div>
      </dl>
    </div>
  );
}
