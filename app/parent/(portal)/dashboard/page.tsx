import Link from "next/link";
import { CalendarClock, Plus, Users } from "lucide-react";

import { linkParentStudentAction } from "@/app/parent/student-link/actions";
import { requireRole } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/students/records";

import {
  MetricCard,
  MetricGrid,
  ParentAlert,
  ParentButton,
  ParentCard,
  ParentField,
  ParentTable,
  StatusPill,
  parentControlClass,
} from "../../_components/parent-ui";

export default async function ParentDashboardPage() {
  const session = await requireRole("parent");
  const data = await getParentDashboardData(session.userId);
  const hasLinkedStudents = data.linkedStudents.length > 0;

  return (
    <>
      {!hasLinkedStudents ? (
        <ParentAlert>
          Link your parent portal to a student reference from the school registrar.
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
                <Link key={student.id} href={student.profileHref} className="flex items-center justify-between gap-3 border-b border-black/[0.08] px-4 py-4 transition hover:bg-[#f8f8f7] focus:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[#e64a19]/20 sm:gap-4 sm:px-5">
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
              <form action={linkParentStudentAction} className="grid gap-3 border-t border-black/[0.08] p-4 sm:p-5">
                <ParentField label="Link another student by reference" required>
                  <input name="studentReference" className={parentControlClass} placeholder="e.g. BWA-2025-0312" required />
                </ParentField>
                <ParentButton type="submit" tone="primary" className="w-full min-[420px]:w-auto">
                  <Plus className="size-4" />
                  Link another student
                </ParentButton>
              </form>
            </>
          ) : (
            <form action={linkParentStudentAction} className="grid gap-3">
              <ParentField label="Student reference" required>
                <input name="studentReference" className={parentControlClass} placeholder="e.g. BWA-2025-0312" required />
              </ParentField>
              <ParentButton type="submit" tone="primary">
                <Plus className="size-4" />
                Link student
              </ParentButton>
            </form>
          )}
        </ParentCard>
        <ParentCard title="Fees and balances" icon={CalendarClock}>
          <div className="grid gap-3 text-[13px] leading-5 text-[#6b6b6b]">
            <p>Current outstanding balance: <span className="font-semibold text-[#c62828]">{data.outstandingBalance}</span></p>
            <Link href="/parent/fees" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-black/15 bg-white px-3.5 text-[13px] font-medium text-[#6b6b6b] transition hover:bg-[#f2f1ef] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20">
              View fee summary
            </Link>
          </div>
        </ParentCard>
      </div>

      <ParentCard title="Recent payment activity" icon={CalendarClock} bodyClassName="p-0">
        <ParentTable
          headers={[
            { label: "Ref #", className: "w-[20%]" },
            { label: "Student", className: "w-[22%]" },
            { label: "Description", className: "w-[26%]" },
            { label: "Amount", className: "w-[16%]" },
            { label: "Status", className: "w-[16%]" },
          ]}
        >
          {data.recentPayments.length > 0 ? (
            data.recentPayments.map((payment) => (
              <tr key={payment.referenceNumber}>
                <td className="font-mono text-[11px] text-[#6b6b6b]">{payment.referenceNumber}</td>
                <td className="font-medium">{payment.studentName}</td>
                <td>{payment.description}</td>
                <td className="font-semibold">{payment.amount}</td>
                <td><StatusPill tone={payment.status === "Paid" ? "green" : "amber"}>{payment.status}</StatusPill></td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="text-center text-[#6b6b6b]">
                No payment records yet.
              </td>
            </tr>
          )}
        </ParentTable>
      </ParentCard>
    </>
  );
}
