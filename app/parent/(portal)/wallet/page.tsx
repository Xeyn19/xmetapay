import { History, Plus, Wallet } from "lucide-react";
import { randomUUID } from "node:crypto";

import { requireRole } from "@/lib/auth/session";
import { getParentWalletPageData } from "@/lib/wallets/records";
import type { ParentWalletSummary } from "@/lib/wallets/records";

import { ParentAlert, ParentCard, StatusPill } from "../../_components/parent-ui";
import { ParentWalletActivityTable } from "../_components/parent-wallet-activity-table";
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
            <div className="text-[13px] leading-5 text-muted-foreground">
              No linked student wallets yet.
            </div>
          )}
        </ParentCard>

        <ParentCard title="Top-up allowance" icon={Plus}>
          {hasLinkedWallets ? (
            <WalletTopUpForm wallets={data.wallets} submissionToken={randomUUID()} />
          ) : (
            <div className="text-[13px] leading-5 text-muted-foreground">
              Link a student first, then return here to top up allowance.
            </div>
          )}
        </ParentCard>

        <ParentCard title="Wallet transaction history" icon={History} className="xl:col-span-2" bodyClassName="p-0">
          <ParentWalletActivityTable
            rows={data.transactions}
            excelFilename="parent-wallet-transactions.xlsx"
            pdfFilename="parent-wallet-transactions.pdf"
            exportTitle="Wallet transaction history"
            worksheetName="Wallet transactions"
          />
        </ParentCard>
      </div>
    </>
  );
}

function BalanceCard({ wallet }: { wallet: ParentWalletSummary }) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary/10 text-lg font-semibold text-primary">
          {wallet.initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{wallet.studentName}</div>
          <div className="truncate text-xs text-muted-foreground">{wallet.meta}</div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-bold">{wallet.balance}</div>
          <div className="mt-1 text-xs text-muted-foreground">Current balance</div>
        </div>
        <StatusPill tone={wallet.tone}>{wallet.statusLabel}</StatusPill>
      </div>
    </div>
  );
}
