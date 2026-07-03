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

  return (
    <form action={createParentPaymentAction} className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <input type="hidden" name="channel" value={method} />
      <div className="grid gap-5">
        <ParentCard title="Select fees to pay" icon={Receipt} bodyClassName="p-0">
          {rows.map((fee) => {
            const disabled = selectedStudentId !== null && selectedStudentId !== fee.studentId && selected.size > 0;
            const selectedKey = rowKey(fee);

            return (
              <label
                key={selectedKey}
                className="flex w-full cursor-pointer items-center justify-between gap-4 border-b border-black/[0.08] px-5 py-4 text-left last:border-b-0 hover:bg-[#f8f8f7] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    name={fee.source === "term" ? "tuitionTermId" : "feeAssignmentId"}
                    value={fee.id}
                    checked={selected.has(selectedKey)}
                    disabled={disabled}
                    onChange={() => toggle(fee)}
                    className="sr-only"
                  />
                  <VisualCheckbox checked={selected.has(selectedKey)} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{fee.feeName}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#6b6b6b]">
                      {fee.studentName} - {fee.studentReference} - Due {fee.dueDate}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold">{fee.balance}</span>
                  <span className="text-[11px] text-[#6b6b6b]">{fee.status}</span>
                </span>
              </label>
            );
          })}
        </ParentCard>

        <ParentCard title="Payment method" icon={CreditCard}>
          <div className="grid gap-3">
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
          <p className="mt-3 text-xs leading-5 text-[#6b6b6b]">
            XMETA wallet fee payments are future work. Wallet top-up is available from the wallet page.
          </p>
        </ParentCard>
      </div>

      <ParentCard title="Payment summary" icon={Receipt} className="self-start">
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-[#6b6b6b]">Selected fees</span>
            <span className="font-semibold">{selectedRows.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b6b6b]">Student</span>
            <span className="max-w-[190px] truncate text-right font-semibold">{selectedRows[0]?.studentName ?? "None selected"}</span>
          </div>
          <div className="border-t border-black/[0.08] pt-3">
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{money(subtotal)}</span>
            </div>
          </div>
          <ParentButton type="submit" tone="primary" className="mt-4 w-full" disabled={subtotal <= 0}>
            Pay {money(subtotal)}
          </ParentButton>
          <a href="/parent/fees" className="flex h-11 w-full items-center justify-center rounded-[10px] border border-black/15 bg-white px-3.5 text-[13px] font-medium text-[#6b6b6b] transition hover:bg-[#f2f1ef]">
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
