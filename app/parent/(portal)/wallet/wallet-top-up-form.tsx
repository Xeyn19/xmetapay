"use client";

import { Check, CreditCard, Landmark, Smartphone, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createWalletTopUpAction } from "@/app/parent/wallet/actions";
import type { ParentWalletSummary, WalletTopUpChannel } from "@/lib/wallets/records";

import { MethodCard, ParentButton, parentControlClass } from "../../_components/parent-ui";

const quickAmounts = [100, 200, 500, 1000];
const maxSelectedWallets = 20;
const walletTopUpMethods: Array<{
  id: WalletTopUpChannel;
  title: string;
  desc: string;
  icon: typeof CreditCard;
}> = [
  { id: "gcash", title: "GCash", desc: "Local test wallet top-up", icon: Smartphone },
  { id: "maya", title: "Maya", desc: "Local test wallet top-up", icon: Smartphone },
  { id: "card", title: "Debit / credit card", desc: "Local test card top-up", icon: CreditCard },
  { id: "online_banking", title: "Online banking", desc: "Local test bank transfer", icon: Landmark },
];

export function WalletTopUpForm({
  wallets,
  submissionToken,
}: {
  wallets: ParentWalletSummary[];
  submissionToken: string;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>(
    Object.fromEntries(wallets.map((wallet) => [wallet.studentId, "200"])),
  );
  const [method, setMethod] = useState<WalletTopUpChannel>("gcash");
  const [reviewing, setReviewing] = useState(false);
  const eligibleWallets = useMemo(
    () => wallets.filter((wallet) => wallet.status !== "frozen" && wallet.status !== "closed"),
    [wallets],
  );
  const selectedWallets = useMemo(
    () => wallets.filter((wallet) => selectedIds.includes(wallet.studentId)),
    [selectedIds, wallets],
  );
  const total = selectedWallets.reduce((sum, wallet) => sum + Number(amounts[wallet.studentId] || 0), 0);
  const amountsValid = selectedWallets.every((wallet) => {
    const amount = Number(amounts[wallet.studentId]);
    return Number.isFinite(amount) && amount >= 1 && amount <= 10000;
  });
  const canReview = submissionToken.length > 0 && selectedWallets.length > 0 && amountsValid;

  const toggleStudent = (studentId: number) => {
    setSelectedIds((current) => {
      if (current.includes(studentId)) return current.filter((id) => id !== studentId);
      return current.length < maxSelectedWallets ? [...current, studentId] : current;
    });
  };

  const applyAmount = (value: number) => {
    setAmounts((current) => ({
      ...current,
      ...Object.fromEntries(selectedIds.map((studentId) => [studentId, String(value)])),
    }));
  };

  return (
    <form action={createWalletTopUpAction} className="grid gap-5">
      <input type="hidden" name="channel" value={method} />
      <input type="hidden" name="submissionToken" value={submissionToken} />
      {selectedWallets.map((wallet) => (
        <div key={wallet.studentId}>
          <input type="hidden" name="studentIds" value={wallet.studentId} />
          <input type="hidden" name={`amount_${wallet.studentId}`} value={amounts[wallet.studentId]} />
        </div>
      ))}

      <section className="grid gap-3" aria-labelledby="student-wallet-selection">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="student-wallet-selection" className="text-[13px] font-semibold text-[#1a1a1a]">
              Student wallets
            </h3>
            <p className="mt-1 text-xs text-[#6b6b6b]">
              {selectedIds.length} selected · up to {maxSelectedWallets}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(eligibleWallets.slice(0, maxSelectedWallets).map((wallet) => wallet.studentId))}
              className="min-h-11 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20"
            >
              Select all eligible
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="min-h-11 rounded-lg px-3 text-xs font-semibold text-[#6b6b6b] disabled:opacity-50 focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20"
            >
              Clear selection
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {wallets.map((wallet) => {
            const unavailable = wallet.status === "frozen" || wallet.status === "closed";
            const selected = selectedIds.includes(wallet.studentId);
            return (
              <div
                key={wallet.studentId}
                className={`rounded-xl border p-3 transition ${
                  selected ? "border-[#e64a19] bg-accent" : "border-border bg-card hover:bg-muted"
                } ${unavailable ? "opacity-65" : ""}`}
              >
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={unavailable}
                    onChange={() => toggleStudent(wallet.studentId)}
                    className="mt-1 size-4 accent-[#e64a19]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{wallet.studentName}</span>
                    <span className="block truncate text-xs text-[#6b6b6b]">{wallet.meta}</span>
                    <span className="mt-1 block text-xs text-[#6b6b6b]">
                      Balance: <strong className="text-[#1a1a1a]">{wallet.balance}</strong>
                    </span>
                    {unavailable ? (
                      <span className="mt-1 block text-xs font-medium text-[#b3261e]">
                        {wallet.statusLabel} wallets cannot receive top-ups.
                      </span>
                    ) : null}
                  </span>
                  {selected ? <Check className="size-5 shrink-0 text-[#e64a19]" /> : null}
                </label>
                {selected ? (
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-semibold">Amount for {wallet.studentName}</span>
                    <input
                      aria-label={`Top-up amount for ${wallet.studentName}`}
                      type="number"
                      min="1"
                      max="10000"
                      step="0.01"
                      value={amounts[wallet.studentId]}
                      onChange={(event) =>
                        setAmounts((current) => ({ ...current, [wallet.studentId]: event.target.value }))
                      }
                      className={parentControlClass}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-2">
        <div className="text-[13px] font-semibold">Apply amount to selected</div>
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
          {quickAmounts.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => applyAmount(value)}
              disabled={selectedIds.length === 0}
              className="min-h-11 rounded-lg border border-border bg-card text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50 focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20"
            >
              P{value}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a]">
          <CreditCard className="size-4 text-[#e64a19]" />
          Payment method
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {walletTopUpMethods.map((item) => (
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
      </section>

      <div className="rounded-xl border border-border bg-muted p-4 text-[13px]">
        <div className="flex justify-between gap-3">
          <span className="text-[#6b6b6b]">Selected wallets</span>
          <span className="font-semibold">{selectedWallets.length}</span>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <span className="text-[#6b6b6b]">Combined top-up</span>
          <span className="text-base font-bold text-[#1a1a1a]">{formatMoney(total)}</span>
        </div>
        {selectedWallets.length > 0 && !amountsValid ? (
          <p className="mt-3 text-xs font-medium text-[#b3261e]">
            Enter P1 to P10,000 for every selected student.
          </p>
        ) : null}
      </div>

      <ParentButton type="button" tone="primary" className="w-full" disabled={!canReview} onClick={() => setReviewing(true)}>
        <Users className="size-4" />
        Review {selectedWallets.length || ""} top-up{selectedWallets.length === 1 ? "" : "s"}
      </ParentButton>

      {reviewing ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wallet-top-up-review-title"
            className="relative my-auto w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6"
          >
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-lg text-[#6b6b6b] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20"
              aria-label="Close top-up review"
            >
              <X className="size-5" />
            </button>
            <h3 id="wallet-top-up-review-title" className="pr-10 text-lg font-bold">
              Confirm allowance top-up
            </h3>
            <p className="mt-2 text-[13px] leading-5 text-[#6b6b6b]">
              All wallet updates are recorded together. If one wallet is unavailable, none will be topped up.
            </p>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {selectedWallets.map((wallet) => (
                <div key={wallet.studentId} className="flex justify-between gap-3 rounded-lg bg-muted p-3 text-[13px]">
                  <span className="min-w-0 truncate font-semibold">{wallet.studentName}</span>
                  <span className="shrink-0 font-bold">{formatMoney(Number(amounts[wallet.studentId]))}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-sm">
              <span className="text-[#6b6b6b]">Total</span>
              <span className="font-bold">{formatMoney(total)}</span>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
              <ParentButton type="button" onClick={() => setReviewing(false)}>Back</ParentButton>
              <SubmitTopUpButton count={selectedWallets.length} />
            </div>
          </section>
        </div>
      ) : null}
    </form>
  );
}

function SubmitTopUpButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <ParentButton type="submit" tone="primary" disabled={pending}>
      <CreditCard className="size-4" />
      {pending ? "Recording top-ups..." : `Top up ${count} wallet${count === 1 ? "" : "s"}`}
    </ParentButton>
  );
}

function formatMoney(value: number) {
  return `P${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
