import Link from "next/link";
import { CheckCircle2, History, Receipt, Wallet } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentWalletTopUpBatch } from "@/lib/wallets/records";

import { ParentAlert, ParentButton, ParentCard } from "../../../_components/parent-ui";

export default async function WalletTopUpResultPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const session = await requireRole("parent");
  const { batch } = await searchParams;
  const reference = typeof batch === "string" && /^[A-Z0-9-]{10,80}$/.test(batch) ? batch : "";
  const data = reference
    ? await getParentWalletTopUpBatch(session.userId, reference)
    : { batch: null, warning: "This wallet top-up batch is unavailable." };

  if (!data.batch) {
    return (
      <div className="mx-auto max-w-4xl">
        <ParentAlert>{data.warning}</ParentAlert>
        <div className="mt-4">
          <Link href="/parent/wallet">
            <ParentButton tone="primary"><Wallet className="size-4" />Back to Wallet & top-up</ParentButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <section className="rounded-xl border border-[#2e7d32]/20 bg-[#e8f5e9] p-5 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-12 text-[#2e7d32]" />
        <h1 className="mt-3 text-xl font-bold text-[#1a1a1a] sm:text-2xl">Allowance top-up complete</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[#6b6b6b]">
          {data.batch.itemCount} student wallet{data.batch.itemCount === 1 ? "" : "s"} received {data.batch.totalAmount} in total.
        </p>
      </section>

      <ParentCard title="Batch summary" icon={Wallet}>
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <SummaryItem label="Batch reference" value={data.batch.reference} />
          <SummaryItem label="Payment method" value={data.batch.channel} />
          <SummaryItem label="Completed" value={data.batch.completedAt} />
          <SummaryItem label="Total amount" value={data.batch.totalAmount} strong />
        </dl>
      </ParentCard>

      <ParentCard title="Student receipts" icon={Receipt} bodyClassName="p-0">
        <div className="divide-y divide-black/[0.07]">
          {data.batch.items.map((item) => (
            <article key={item.paymentId} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
              <div className="min-w-0">
                <h2 className="truncate text-[13px] font-semibold">{item.studentName}</h2>
                <p className="mt-1 truncate text-xs text-[#6b6b6b]">
                  {item.studentReference} · {item.paymentReference}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  <span>Top-up: <strong>{item.amount}</strong></span>
                  <span>New balance: <strong>{item.balanceAfter}</strong></span>
                </div>
              </div>
              <Link href={`/parent/receipt?receiptId=${item.receiptId}`}>
                <ParentButton className="w-full sm:w-auto">
                  <Receipt className="size-4" />View receipt
                </ParentButton>
              </Link>
            </article>
          ))}
        </div>
      </ParentCard>

      <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
        <Link href="/parent/history">
          <ParentButton className="w-full min-[420px]:w-auto"><History className="size-4" />Payment history</ParentButton>
        </Link>
        <Link href="/parent/wallet">
          <ParentButton tone="primary" className="w-full min-[420px]:w-auto"><Wallet className="size-4" />Back to Wallet & top-up</ParentButton>
        </Link>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-[#f8f8f7] p-3">
      <dt className="text-xs text-[#6b6b6b]">{label}</dt>
      <dd className={`mt-1 break-words ${strong ? "text-base font-bold text-[#2e7d32]" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}
