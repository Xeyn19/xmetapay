import Link from "next/link";
import { CheckCircle2, Home, Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentReceiptData } from "@/lib/payments/records";

import { DetailRows, ParentAlert, ParentButton, ParentCard } from "../../_components/parent-ui";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ receiptId?: string }>;
}) {
  const session = await requireRole("parent");
  const { receiptId } = await searchParams;
  const parsedReceiptId = receiptId ? Number(receiptId) : NaN;
  const selectedReceiptId = Number.isInteger(parsedReceiptId) && parsedReceiptId > 0 ? parsedReceiptId : undefined;
  const data = await getParentReceiptData(session.userId, selectedReceiptId);

  if (!data.receipt) {
    return (
      <div className="mx-auto max-w-3xl">
        {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
        <ParentCard title="Receipt unavailable" icon={Receipt}>
          <div className="grid gap-4 text-[13px] leading-5 text-[#6b6b6b]">
            <p>No payment receipt is available for this parent account yet.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/parent/pay-tuition"><ParentButton tone="primary"><Receipt className="size-4" />Pay fees</ParentButton></Link>
              <Link href="/parent/history"><ParentButton><Receipt className="size-4" />Payment history</ParentButton></Link>
            </div>
          </div>
        </ParentCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="mb-5 rounded-[20px] border border-[#2e7d32]/20 bg-[#e8f5e9] p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-[#2e7d32]" />
        <h2 className="mt-4 text-2xl font-bold text-[#1a1a1a]">Payment complete</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">Your payment was recorded in the school fee ledger.</p>
      </section>
      <ParentCard title="Transaction receipt" icon={Receipt}>
        <DetailRows
          rows={[
            { label: "Receipt number", value: data.receipt.receiptNumber },
            { label: "Reference number", value: data.receipt.referenceNumber },
            { label: "Student", value: `${data.receipt.studentName} (${data.receipt.studentReference})` },
            { label: "Paid items", value: data.receipt.paidItems },
            { label: "Payment method", value: data.receipt.channel },
            { label: "Total paid", value: data.receipt.amount, tone: "green" },
            { label: "Status", value: data.receipt.status, tone: "green" },
            { label: "Date", value: data.receipt.paidAt },
          ]}
        />
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Link href="/parent/history"><ParentButton><Receipt className="size-4" />Payment history</ParentButton></Link>
          <Link href="/parent/dashboard"><ParentButton tone="primary"><Home className="size-4" />Back to dashboard</ParentButton></Link>
        </div>
      </ParentCard>
    </div>
  );
}
