import { ChevronDown, Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentFeePageData } from "@/lib/fees/records";
import { getParentAssessmentStatements } from "@/lib/fees/assessment-workflow";

import { MetricCard, MetricGrid, ParentAlert } from "../../_components/parent-ui";
import { ParentFeesTable } from "./fees-table";
import { AssessmentStatements } from "./assessment-statements";

export default async function FeesPage() {
  const session = await requireRole("parent");
  const [data, statements] = await Promise.all([getParentFeePageData(session.userId), getParentAssessmentStatements(session.userId)]);

  return (
    <>
      {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
      <MetricGrid>
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </MetricGrid>
      <AssessmentStatements statements={statements} />
      <details className="group overflow-hidden rounded-xl border border-border bg-card">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <Receipt className="size-4 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-foreground">All fee records and archive history</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Underlying tuition lines, other fees, legacy records, and your saved archive views.</span>
            </span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border">
          <ParentFeesTable activeRows={data.activeRows} archivedRows={data.archivedRows} removedRows={data.removedRows} />
        </div>
      </details>
    </>
  );
}

