"use client";

import { CreditCard, Landmark, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

import { createWalletTopUpAction } from "@/app/parent/wallet/actions";
import type { ParentWalletSummary, WalletTopUpChannel } from "@/lib/wallets/records";

import { MethodCard, ParentButton, ParentField, parentControlClass } from "../../_components/parent-ui";

const quickAmounts = [100, 200, 500, 1000];
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

export function WalletTopUpForm({ wallets }: { wallets: ParentWalletSummary[] }) {
  const [selectedStudentId, setSelectedStudentId] = useState(String(wallets[0]?.studentId ?? ""));
  const [amount, setAmount] = useState("200");
  const [method, setMethod] = useState<WalletTopUpChannel>("gcash");
  const selectedWallet = useMemo(
    () => wallets.find((wallet) => String(wallet.studentId) === selectedStudentId) ?? null,
    [selectedStudentId, wallets],
  );
  const amountValue = Number(amount);
  const canSubmit = selectedWallet?.status !== "frozen"
    && selectedWallet?.status !== "closed"
    && Number.isFinite(amountValue)
    && amountValue > 0
    && amountValue <= 10000;

  return (
    <form action={createWalletTopUpAction} className="grid gap-4">
      <input type="hidden" name="channel" value={method} />
      <ParentField label="Student wallet" required>
        <select
          name="studentId"
          value={selectedStudentId}
          onChange={(event) => setSelectedStudentId(event.target.value)}
          className={parentControlClass}
          required
        >
          {wallets.map((wallet) => (
            <option key={wallet.studentId} value={wallet.studentId}>
              {wallet.studentName} - {wallet.studentReference}
            </option>
          ))}
        </select>
      </ParentField>

      <div className="grid gap-2">
        <ParentField label="Top-up amount" required>
          <input
            name="amount"
            type="number"
            min="1"
            max="10000"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={parentControlClass}
            required
          />
        </ParentField>
        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(String(value))}
              className={amount === String(value) ? "h-9 rounded-[10px] bg-[#e64a19] text-sm font-semibold text-white" : "h-9 rounded-[10px] border border-black/15 bg-white text-sm font-semibold text-[#6b6b6b] hover:bg-[#f2f1ef]"}
            >
              P{value}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a]">
          <CreditCard className="size-4 text-[#e64a19]" />
          Payment method
        </div>
        <div className="grid gap-3">
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

      <div className="rounded-xl border border-black/[0.08] bg-[#f8f8f7] p-4 text-[13px] leading-5">
        <div className="flex justify-between gap-3">
          <span className="text-[#6b6b6b]">Selected wallet</span>
          <span className="max-w-[210px] truncate text-right font-semibold">{selectedWallet?.studentName ?? "None selected"}</span>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <span className="text-[#6b6b6b]">Current balance</span>
          <span className="font-semibold">{selectedWallet?.balance ?? "Pending"}</span>
        </div>
      </div>

      <ParentButton type="submit" tone="primary" className="w-full" disabled={!canSubmit}>
        <CreditCard className="size-4" />
        Top up wallet
      </ParentButton>
    </form>
  );
}
