import Link from "next/link";
import { ArrowRight, CalendarClock, Users, Wallet } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/students/records";

import {
  MetricCard,
  MetricGrid,
  ParentAlert,
  ParentCard,
  StatusPill,
} from "../../_components/parent-ui";
import { ParentRecentPaymentsTable } from "./parent-recent-payments-table";
import { ParentWalletActivityTable } from "../_components/parent-wallet-activity-table";

export default async function ParentDashboardPage() {
  const session = await requireRole("parent");
  const data = await getParentDashboardData(session.userId);
  const hasLinkedStudents = data.linkedStudents.length > 0;

  return (
    <>
      {!hasLinkedStudents ? (
        <ParentAlert>
          Submit your child’s official student details. The school will review the connection before records appear here.
        </ParentAlert>
      ) : null}

      <MetricGrid>
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </MetricGrid>

      <div className="mb-10 grid gap-5 xl:grid-cols-2">
        <ParentCard
          title="My students"
          icon={Users}
          action={<Link href="/parent/students" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Manage students <ArrowRight className="size-4" /></Link>}
          bodyClassName={hasLinkedStudents ? "p-0" : undefined}
        >
          {hasLinkedStudents ? (
            <>
              {data.linkedStudents.map((student) => (
                <Link key={student.id} href={student.profileHref} className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:gap-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary/10 text-lg font-semibold text-primary">
                      {student.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium text-foreground">{student.fullName}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{student.meta}</div>
                    </div>
                  </div>
                  <StatusPill tone={student.status === "active" ? "blue" : "muted"}>
                    {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </StatusPill>
                </Link>
              ))}
            </>
          ) : (
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>Add your child using the exact student reference and official name. The school reviews new connections before records appear.</p>
              <Link href="/parent/students" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 min-[420px]:w-fit">Add a student <ArrowRight className="size-4" /></Link>
            </div>
          )}
        </ParentCard>
        <ParentCard title="Fees and balances" icon={CalendarClock}>
          <div className="grid gap-3 text-[13px] leading-5 text-muted-foreground">
            <p>Current outstanding balance: <span className="font-semibold text-status-danger-foreground">{data.outstandingBalance}</span></p>
            <Link href="/parent/fees" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              View fee summary
            </Link>
          </div>
        </ParentCard>
      </div>

      <ParentCard title="Recent payment activity" icon={CalendarClock} bodyClassName="p-0" action={<Link href="/parent/history" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">View all <ArrowRight className="size-4" /></Link>}>
        <ParentRecentPaymentsTable rows={data.recentPayments} />
      </ParentCard>

      <ParentCard
        title="Recent wallet activity"
        icon={Wallet}
        bodyClassName="p-0"
        className="mt-5"
        action={(
          <Link href="/parent/wallet" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            View full history
          </Link>
        )}
      >
          <ParentWalletActivityTable rows={data.walletActivity} compactPreview />
      </ParentCard>
    </>
  );
}
