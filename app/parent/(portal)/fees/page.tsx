import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";

import { FeeRow, MetricCard, MetricGrid, ParentButton, ParentCard } from "../../_components/parent-ui";
import { feeSummary } from "../../_data/parent-portal-data";

export default function FeesPage() {
  return (
    <>
      <MetricGrid>
        <MetricCard metric={{ label: "Total billed", value: "P9,550", note: "Across two students" }} />
        <MetricCard metric={{ label: "Paid", value: "P7,450", note: "78% complete", tone: "green" }} />
        <MetricCard metric={{ label: "Outstanding", value: "P1,100", note: "2 items due", tone: "red" }} />
        <MetricCard metric={{ label: "Next due date", value: "Jun 15", note: "PTA contribution" }} />
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

