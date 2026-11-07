"use client";

import { CreditCard, Landmark, Receipt, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

import { createParentPaymentAction } from "@/app/parent/payments/actions";
import type { ParentPayableFee, PaymentChannel } from "@/lib/payments/records";

import { MethodCard, ParentButton, ParentCard, VisualCheckbox } from "../../_components/parent-ui";

const paymentMethods: Array<{
  id: PaymentChannel;
  title: string;
  desc: string;
  icon: typeof CreditCard;
}> = [
  { id: "gcash", title: "GCash", desc: "Local test e-wallet payment", icon: Smartphone },
  { id: "maya", title: "Maya", desc: "Local test e-wallet payment", icon: Smartphone },
  { id: "card", title: "Debit / credit card", desc: "Local test card payment", icon: CreditCard },
  { id: "online_banking", title: "Online banking", desc: "Local test bank transfer", icon: Landmark },
  { id: "cash", title: "Cash", desc: "Local over-the-counter record", icon: Receipt },
];

function rowKey(row: ParentPayableFee) {
  return `${row.source}-${row.id}`;
}

export function ParentPaymentForm({ rows }: { rows: ParentPayableFee[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(rows.slice(0, 1).map(rowKey)));
  const [method, setMethod] = useState<PaymentChannel>("gcash");
  const [activeStudentId, setActiveStudentId] = useState(rows[0]?.studentId ?? 0);
  const students = useMemo(() => [...new Map(rows.map((row) => [row.studentId, { id: row.studentId, name: row.studentName, reference: row.studentReference }])).values()], [rows]);
  const activeRows = useMemo(() => rows.filter((row) => row.studentId === activeStudentId), [activeStudentId, rows]);
  const tuitionRows = activeRows.filter((row) => row.category === "tuition");
  const otherRows = activeRows.filter((row) => row.category !== "tuition");
  const selectedRows = useMemo(() => rows.filter((row) => selected.has(rowKey(row))), [rows, selected]);
  const selectedStudentId = selectedRows[0]?.studentId ?? null;
  const subtotal = selectedRows.reduce((sum, row) => sum + row.balanceValue, 0);

  const toggle = (fee: ParentPayableFee) => {
    setSelected((current) => {
      const key = rowKey(fee);
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
        return next;
      }

      if (selectedStudentId && selectedStudentId !== fee.studentId) {
        return new Set([key]);
      }

      next.add(key);
      return next;
    });
  };

  const chooseStudent = (studentId: number) => {
    setActiveStudentId(studentId);
    const firstPayable = rows.find((row) => row.studentId === studentId);
    setSelected(new Set(firstPayable ? [rowKey(firstPayable)] : []));
  };

  return (
    <form action={createParentPaymentAction} className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <input type="hidden" name="channel" value={method} />
      <div className="grid gap-5">
        {students.length > 1 ? (
          <ParentCard title="Choose a student" icon={Receipt}>
            <p className="mb-3 text-sm text-muted-foreground">A payment can cover fees for one student at a time.</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Student to pay for">
              {students.map((student) => (
                <button key={student.id} type="button" role="radio" aria-checked={student.id === activeStudentId} onClick={() => chooseStudent(student.id)} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${student.id === activeStudentId ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
                  <span className="block font-semibold text-foreground">{student.name}</span>
                  <span className="block text-xs">{student.reference}</span>
                </button>
              ))}
            </div>
          </ParentCard>
        ) : null}
        <ParentCard title="Select fees to pay" icon={Receipt} bodyClassName="p-0">
          <p className="border-b border-border px-5 py-3 text-xs leading-5 text-muted-foreground">The earliest payable item is selected for you. Choose additional items for the same student if needed.</p>
          {tuitionRows.length > 0 ? <div className="bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tuition and scheduled payments</div> : null}
          {tuitionRows.map((fee) => {
            const disabled = selectedStudentId !== null && selectedStudentId !== fee.studentId && selected.size > 0;
            const selectedKey = rowKey(fee);

            return (
              <label
                key={selectedKey}
                className="flex w-full cursor-pointer items-center justify-between gap-4 border-b border-border px-5 py-4 text-left last:border-b-0 hover:bg-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    name={fee.source === "term" ? "tuitionTermId" : fee.source === "assessment_term" ? "assessmentTermId" : "feeAssignmentId"}
                    value={fee.id}
                    checked={selected.has(selectedKey)}
                    disabled={disabled}
                    onChange={() => toggle(fee)}
                    className="sr-only"
                  />
                  <VisualCheckbox checked={selected.has(selectedKey)} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{fee.feeName}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {fee.studentName} - {fee.studentReference} - Due {fee.dueDate}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold">{fee.balance}</span>
                  <span className="text-[11px] text-muted-foreground">{fee.status}</span>
                </span>
              </label>
            );
          })}
          {otherRows.length > 0 ? <div className="bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other school fees</div> : null}
          {otherRows.map((fee) => {
            const selectedKey = rowKey(fee);
            return (
              <label key={selectedKey} className="flex w-full cursor-pointer items-center justify-between gap-4 border-b border-border px-5 py-4 text-left last:border-b-0 hover:bg-muted">
                <span className="flex min-w-0 items-center gap-3">
                  <input type="checkbox" name="feeAssignmentId" value={fee.id} checked={selected.has(selectedKey)} onChange={() => toggle(fee)} className="sr-only" />
                  <VisualCheckbox checked={selected.has(selectedKey)} />
                  <span className="min-w-0"><span className="block truncate text-[15px] font-medium">{fee.feeName}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">Due {fee.dueDate}</span></span>
                </span>
                <span className="shrink-0 text-right"><span className="block font-semibold">{fee.balance}</span><span className="text-[11px] text-muted-foreground">{fee.status}</span></span>
              </label>
            );
          })}
        </ParentCard>

        <ParentCard title="Payment method" icon={CreditCard}>
          <div className="grid gap-3 sm:grid-cols-2">
            {paymentMethods.map((item) => (
              <MethodCard
                key={item.id}
                selected={method === item.id}
                onClick={() => setMethod(item.id)}
                icon={item.icon}
                title={item.title}
                desc={item.desc}
              />
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            XMETA wallet fee payments are future work. Wallet top-up is available from the wallet page.
          </p>
        </ParentCard>
      </div>

      <ParentCard title="Payment summary" icon={Receipt} className="self-start xl:sticky xl:top-24">
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Selected fees</span>
            <span className="font-semibold">{selectedRows.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Student</span>
            <span className="max-w-[190px] truncate text-right font-semibold">{selectedRows[0]?.studentName ?? "None selected"}</span>
          </div>
            <div className="border-t border-border pt-3">
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{money(subtotal)}</span>
            </div>
          </div>
          <ParentButton type="submit" tone="primary" className="mt-4 w-full" disabled={subtotal <= 0}>
            Pay {money(subtotal)}
          </ParentButton>
          <a href="/parent/fees" className="flex h-11 w-full items-center justify-center rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
            Back to fee summary
          </a>
        </div>
      </ParentCard>
    </form>
  );
}

function money(value: number) {
  return `P${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
