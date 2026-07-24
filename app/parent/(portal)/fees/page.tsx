import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentFeePageData } from "@/lib/fees/records";

import { MetricCard, MetricGrid, ParentAlert, ParentButton, ParentCard } from "../../_components/parent-ui";
import { ParentFeesTable } from "./fees-table";

export default async function FeesPage() {
  const session = await requireRole("parent");
  const data = await getParentFeePageData(session.userId);

  return (
    <>
      {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
      <MetricGrid>
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </MetricGrid>
      <ParentCard
        title="Fee summary"
        icon={Receipt}
        action={
          data.hasPayableFees ? (
            <Link href="/parent/pay-tuition" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#e64a19] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25">
              <CreditCard className="size-4" />
              Pay fees
            </Link>
          ) : (
            <ParentButton tone="primary" disabled><CreditCard className="size-4" />No balance due</ParentButton>
          )
        }
        bodyClassName="p-0"
      >
        <ParentFeesTable activeRows={data.activeRows} archivedRows={data.archivedRows} removedRows={data.removedRows} />
      </ParentCard>
    </>
  );
}

