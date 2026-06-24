"use client";

import { useState } from "react";
import { CreditCard, History, Plus, Wallet } from "lucide-react";

import { MethodCard, ParentButton, ParentCard, ParentTable, StatusPill } from "../../_components/parent-ui";
import { paymentMethods, walletQuickAmounts, walletTransactions } from "../../_data/parent-portal-data";

export default function WalletPage() {
  const [amount, setAmount] = useState(200);
  const [method, setMethod] = useState("wallet");

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <ParentCard title="Wallet balances" icon={Wallet}>
        <div className="grid gap-3 sm:grid-cols-2">
          <BalanceCard initials="ST" name="Linked student wallet" balance="Pending" />
          <BalanceCard initials="ST" name="Additional linked wallet" balance="Pending" blue />
        </div>
      </ParentCard>

      <ParentCard title="Top-up allowance" icon={Plus}>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {walletQuickAmounts.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className={amount === value ? "h-9 rounded-[10px] bg-[#e64a19] text-sm font-semibold text-white" : "h-9 rounded-[10px] border border-black/15 bg-white text-sm font-semibold text-[#6b6b6b] hover:bg-[#f2f1ef]"}
            >
              P{value}
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          {paymentMethods.slice(1).map((item) => (
            <MethodCard key={item.id} selected={method === item.id} onClick={() => setMethod(item.id)} icon={item.icon} title={item.title} desc={item.desc} />
          ))}
        </div>
        <ParentButton tone="primary" className="mt-4 w-full"><CreditCard className="size-4" />Top-up P{amount}</ParentButton>
      </ParentCard>

      <ParentCard title="Wallet transaction history" icon={History} className="xl:col-span-2" bodyClassName="p-0">
        <ParentTable
          headers={[
            { label: "Date", className: "w-[15%]" },
            { label: "Student", className: "w-[20%]" },
            { label: "Description", className: "w-[28%]" },
            { label: "Amount", className: "w-[12%]" },
            { label: "Channel", className: "w-[13%]" },
            { label: "Status", className: "w-[12%]" },
          ]}
        >
          {walletTransactions.map(([date, student, description, txnAmount, channel, status]) => (
            <tr key={`${date}-${description}`}>
              <td>{date}</td>
              <td className="font-medium">{student}</td>
              <td>{description}</td>
              <td className={txnAmount.startsWith("+") ? "font-semibold text-[#2e7d32]" : "font-semibold text-[#c62828]"}>{txnAmount}</td>
              <td>{channel}</td>
              <td><StatusPill tone="green">{status}</StatusPill></td>
            </tr>
          ))}
        </ParentTable>
      </ParentCard>
    </div>
  );
}

function BalanceCard({ initials, name, balance, blue = false }: { initials: string; name: string; balance: string; blue?: boolean }) {
  return (
    <div className="rounded-[14px] border border-black/[0.08] bg-[#f8f8f7] p-4">
      <div className="flex items-center gap-3">
        <span className={blue ? "flex size-10 items-center justify-center rounded-[10px] bg-[#e3f2fd] text-lg font-semibold text-[#1565c0]" : "flex size-10 items-center justify-center rounded-[10px] bg-[#fbe9e7] text-lg font-semibold text-[#e64a19]"}>
          {initials}
        </span>
        <div>
          <div className="text-[13px] font-semibold">{name}</div>
          <div className="text-xs text-[#6b6b6b]">Current balance</div>
        </div>
      </div>
      <div className="mt-4 text-2xl font-bold">{balance}</div>
    </div>
  );
}

