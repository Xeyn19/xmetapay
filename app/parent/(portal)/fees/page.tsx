import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";

import { FeeRow, MetricCard, MetricGrid, ParentButton, ParentCard } from "../../_components/parent-ui";
import { feeSummary } from "../../_data/parent-portal-data";

export default function FeesPage() {
  return (
    <>
      <MetricGrid>
        <MetricCard metric={{ label: "Total billed", value: "Pending", note: "Fee backend pending" }} />
        <MetricCard metric={{ label: "Paid", value: "Pending", note: "Payment records pending", tone: "green" }} />
        <MetricCard metric={{ label: "Outstanding", value: "Pending", note: "Balances pending", tone: "red" }} />
        <MetricCard metric={{ label: "Next due date", value: "Pending", note: "Due dates pending" }} />
      </MetricGrid>
      <ParentCard
        title="Fee summary"
        icon={Receipt}
        action={<Link href="/parent/pay-tuition"><ParentButton tone="primary"><CreditCard className="size-4" />Pay outstanding</ParentButton></Link>}
        bodyClassName="p-0"
      >
        {feeSummary.map((fee) => (
          <FeeRow key={fee.title} {...fee} />
        ))}
      </ParentCard>
    </>
  );
}

