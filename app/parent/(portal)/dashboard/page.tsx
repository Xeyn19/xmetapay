import Link from "next/link";
import { CalendarClock, KeyRound, Users, Wallet } from "lucide-react";

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
          Ask your school administrator for a parent invitation, then verify the emailed code.
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
          bodyClassName={hasLinkedStudents ? "p-0" : undefined}
        >
          {hasLinkedStudents ? (
            <>
              {data.linkedStudents.map((student) => (
                <Link key={student.id} href={student.profileHref} className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[#e64a19]/20 sm:gap-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#fbe9e7] text-lg font-semibold text-[#e64a19]">
                      {student.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium text-[#1a1a1a]">{student.fullName}</div>
                      <div className="mt-0.5 truncate text-xs text-[#6b6b6b]">{student.meta}</div>
                    </div>
                  </div>
                  <StatusPill tone={student.status === "active" ? "blue" : "muted"}>
                    {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </StatusPill>
                </Link>
              ))}
              <div className="grid gap-3 border-t border-border p-4 sm:p-5">
                <p className="text-xs leading-5 text-[#6b6b6b]">Each additional child requires a separate invitation emailed by the school administrator.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/parent/register" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white min-[420px]:w-auto"><KeyRound className="size-4" />Enter invitation code</Link>
                  <Link href="/parent/students" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20">
                    Manage students
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-3"><p className="text-sm leading-6 text-[#6b6b6b]">Student references cannot grant portal access. Use the single-use invitation emailed by your school.</p><Link href="/parent/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white"><KeyRound className="size-4" />Enter invitation code</Link></div>
          )}
        </ParentCard>
        <ParentCard title="Fees and balances" icon={CalendarClock}>
          <div className="grid gap-3 text-[13px] leading-5 text-[#6b6b6b]">
            <p>Current outstanding balance: <span className="font-semibold text-[#c62828]">{data.outstandingBalance}</span></p>
            <Link href="/parent/fees" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20">
              View fee summary
            </Link>
          </div>
        </ParentCard>
      </div>

      <ParentCard title="Recent payment activity" icon={CalendarClock} bodyClassName="p-0">
        <ParentRecentPaymentsTable rows={data.recentPayments} />
      </ParentCard>

      <ParentCard
        title="Recent wallet activity"
        icon={Wallet}
        bodyClassName="p-0"
        className="mt-5"
        action={(
          <Link href="/parent/wallet" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20">
            View full history
          </Link>
        )}
      >
        <ParentWalletActivityTable rows={data.walletActivity} />
      </ParentCard>
    </>
  );
}
