"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";

import { AdminButton, Field, fieldControlClass } from "../_components/admin-ui";

export type TuitionTermScheduleInitialTerm = {
  key: string;
  name: string;
  amount: string | number;
  dueDate: string;
};

export function TuitionTermScheduleFields({
  totalAmount,
  initialTerms = [],
  defaultTermCount = 0,
  optional = false,
  title = "Payment terms",
  emptyText = "No payment term template yet.",
  addLabel = "Add term",
  latestDueDate = null,
}: {
  totalAmount: number;
  initialTerms?: TuitionTermScheduleInitialTerm[];
  defaultTermCount?: number;
  optional?: boolean;
  title?: string;
  emptyText?: string;
  addLabel?: string;
  latestDueDate?: string | null;
}) {
  const summaryId = useId();
  const [terms, setTerms] = useState(() => initialEditableTerms(initialTerms, defaultTermCount, totalAmount));
  const termTotal = terms.reduce((sum, term) => sum + Number(term.amount || 0), 0);
  const hasMatchingTotal = Math.round(termTotal * 100) === Math.round(totalAmount * 100);

  return (
    <section className="rounded-lg border border-black/[0.07] bg-white p-3.5" aria-describedby={summaryId}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[12.5px] font-bold text-[#0f1117]">{title}</div>
          <p className="mt-1 text-[11.5px] leading-5 text-[#5a6070]">
            {optional
              ? "Optional. Each term needs a schedule date, but the fee due date remains the official parent deadline."
              : latestDueDate
                ? "Split this tuition balance into installments. Term dates must be on or before the fee due date."
                : "Split this tuition balance into scheduled installments. Term dates are schedule details."}
          </p>
        </div>
        <span
          id={summaryId}
          className={hasMatchingTotal || (optional && terms.length === 0) ? "text-[11.5px] font-bold text-[#2e7d32]" : "text-[11.5px] font-bold text-[#c62828]"}
        >
          Total: {money(termTotal)}
        </span>
      </div>

      {terms.length > 0 ? (
        <div className="grid gap-3">
          {terms.map((term, index) => (
            <div key={term.key} className="grid gap-3 rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3 min-[720px]:grid-cols-[1fr_150px_170px_44px]">
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
              <Field label="Term due date" required>
                <input
                  name="termDueDate"
                  type="date"
                  value={term.dueDate}
                  max={latestDueDate ?? undefined}
                  onChange={(event) => updateTerm(setTerms, term.key, "dueDate", event.target.value)}
                  className={fieldControlClass}
                  required
                />
              </Field>
              <button
                type="button"
                onClick={() => setTerms((current) => rebalanceTerms(current.filter((item) => item.key !== term.key), totalAmount))}
                className="mt-auto inline-flex min-h-12 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={`Remove ${term.name}`}
                disabled={!optional && terms.length === 1}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-black/15 bg-[#f7f8fa] px-3 py-4 text-center text-[12.5px] text-[#5a6070]">
          {emptyText}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AdminButton
          type="button"
          tone="outline"
          className="min-h-10 px-3 text-[12px]"
          onClick={() => setTerms((current) => rebalanceTerms([...current, blankTerm(current.length, totalAmount)], totalAmount))}
          disabled={terms.length >= 12 || totalAmount <= 0}
        >
          <Plus className="size-4" />
          {addLabel}
        </AdminButton>
        {terms.length > 0 ? (
          <AdminButton
            type="button"
            tone="ghost"
            className="min-h-10 px-3 text-[12px]"
            onClick={() => setTerms((current) => rebalanceTerms(current, totalAmount))}
            disabled={totalAmount <= 0}
          >
            Rebalance to {money(totalAmount)}
          </AdminButton>
        ) : null}
      </div>
      <p className="mt-2 text-[11.5px] leading-5 text-[#5a6070]">
        {totalAmount > 0 ? "Term amounts must match the tuition amount before saving." : "Enter the tuition default amount before adding terms."}
      </p>
    </section>
  );
}

function initialEditableTerms(initialTerms: TuitionTermScheduleInitialTerm[], defaultTermCount: number, totalAmount: number) {
  if (initialTerms.length > 0) {
    return initialTerms.map((term) => ({
      key: term.key,
      name: term.name,
      amount: String(term.amount),
      dueDate: term.dueDate,
    }));
  }

  if (defaultTermCount > 0) {
    return splitAmount(totalAmount, defaultTermCount).map((amount, index) => ({
      key: `new-${index}`,
      name: `Term ${index + 1}`,
      amount: String(amount),
      dueDate: "",
    }));
  }

  return [];
}

function blankTerm(index: number, totalAmount: number) {
  return {
    key: `new-${Date.now()}-${index}`,
    name: `Term ${index + 1}`,
    amount: totalAmount > 0 ? String(totalAmount) : "",
    dueDate: "",
  };
}

function rebalanceTerms<T extends { amount: string }>(terms: T[], total: number): T[] {
  if (terms.length === 0 || total <= 0) {
    return terms;
  }

  const split = splitAmount(total, Math.max(terms.length, 1));

  return terms.map((term, index) => ({
    ...term,
    amount: String(split[index] ?? 0),
  }));
}

function updateTerm(
  setTerms: (updater: (current: Array<{ key: string; name: string; amount: string; dueDate: string }>) => Array<{ key: string; name: string; amount: string; dueDate: string }>) => void,
  key: string,
  field: "name" | "amount" | "dueDate",
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
