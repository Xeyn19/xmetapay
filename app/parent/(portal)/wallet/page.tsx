import { History, Plus, Wallet } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentWalletPageData } from "@/lib/wallets/records";
import type { ParentWalletSummary } from "@/lib/wallets/records";

import { ParentAlert, ParentCard, ParentTable, StatusPill } from "../../_components/parent-ui";
import { WalletTopUpForm } from "./wallet-top-up-form";

export default async function WalletPage() {
  const session = await requireRole("parent");
  const data = await getParentWalletPageData(session.userId);
  const hasLinkedWallets = data.wallets.length > 0;

  return (
    <>
      {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
      {!hasLinkedWallets ? (
        <ParentAlert>
          Link a student reference from the parent dashboard before using allowance wallets.
        </ParentAlert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ParentCard title="Wallet balances" icon={Wallet}>
          {hasLinkedWallets ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.wallets.map((wallet) => (
                <BalanceCard key={wallet.studentId} wallet={wallet} />
              ))}
            </div>
          ) : (
            <div className="text-[13px] leading-5 text-[#6b6b6b]">
              No linked student wallets yet.
            </div>
          )}
        </ParentCard>

        <ParentCard title="Top-up allowance" icon={Plus}>
          {hasLinkedWallets ? (
            <WalletTopUpForm wallets={data.wallets} />
          ) : (
            <div className="text-[13px] leading-5 text-[#6b6b6b]">
              Link a student first, then return here to top up allowance.
            </div>
          )}
        </ParentCard>

        <ParentCard title="Wallet transaction history" icon={History} className="xl:col-span-2" bodyClassName="p-0">
          <ParentTable
            headers={[
              { label: "Date", className: "w-[16%]" },
              { label: "Student", className: "w-[18%]" },
              { label: "Description", className: "w-[22%]" },
              { label: "Amount", className: "w-[11%]" },
              { label: "Balance after", className: "w-[13%]" },
              { label: "Channel", className: "w-[11%]" },
              { label: "Status", className: "w-[9%]" },
            ]}
          >
            {data.transactions.length > 0 ? (
              data.transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.date}</td>
                  <td className="font-medium">{transaction.studentName}</td>
                  <td>{transaction.description}</td>
                  <td className={transaction.amount.startsWith("+") ? "font-semibold text-[#2e7d32]" : "font-semibold text-[#c62828]"}>
                    {transaction.amount}
                  </td>
                  <td>{transaction.balanceAfter}</td>
                  <td>{transaction.channel}</td>
                  <td><StatusPill tone={transaction.tone}>{transaction.status}</StatusPill></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center text-[#6b6b6b]">
                  No wallet transactions yet.
                </td>
              </tr>
            )}
          </ParentTable>
        </ParentCard>
      </div>
    </>
  );
}

function BalanceCard({ wallet }: { wallet: ParentWalletSummary }) {
  return (
    <div className="rounded-[14px] border border-black/[0.08] bg-[#f8f8f7] p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#fbe9e7] text-lg font-semibold text-[#e64a19]">
          {wallet.initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{wallet.studentName}</div>
          <div className="truncate text-xs text-[#6b6b6b]">{wallet.meta}</div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-bold">{wallet.balance}</div>
          <div className="mt-1 text-xs text-[#6b6b6b]">Current balance</div>
        </div>
        <StatusPill tone={wallet.tone}>{wallet.statusLabel}</StatusPill>
      </div>
    </div>
  );
}
