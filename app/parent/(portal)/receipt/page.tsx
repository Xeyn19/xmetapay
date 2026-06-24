import Link from "next/link";
import { CheckCircle2, Home, Receipt } from "lucide-react";

import { DetailRows, ParentButton, ParentCard } from "../../_components/parent-ui";

export default function ReceiptPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <section className="mb-5 rounded-[20px] border border-[#2e7d32]/20 bg-[#e8f5e9] p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-[#2e7d32]" />
        <h2 className="mt-4 text-2xl font-bold text-[#1a1a1a]">Payment complete</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">Your payment has been recorded in this UI prototype.</p>
      </section>
      <ParentCard title="Transaction receipt" icon={Receipt}>
        <DetailRows
          rows={[
            { label: "Reference number", value: "Pending" },
            { label: "Student", value: "Linked student" },
            { label: "Paid items", value: "Payment backend pending" },
            { label: "Payment method", value: "Pending" },
            { label: "Total paid", value: "Pending", tone: "green" },
            { label: "Date", value: "Pending" },
          ]}
        />
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Link href="/parent/fees"><ParentButton><Receipt className="size-4" />View all fees</ParentButton></Link>
          <Link href="/parent/dashboard"><ParentButton tone="primary"><Home className="size-4" />Back to dashboard</ParentButton></Link>
        </div>
      </ParentCard>
    </div>
  );
}

