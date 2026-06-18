import Link from "next/link";
import { CalendarClock, Plus, Users } from "lucide-react";

import {
  FeeRow,
  MetricCard,
  MetricGrid,
  ParentAlert,
  ParentButton,
  ParentCard,
  ParentTable,
  StatusPill,
} from "../../_components/parent-ui";
import { children, dashboardMetrics, outstandingFees, recentActivity } from "../../_data/parent-portal-data";

export default function ParentDashboardPage() {
  return (
    <>
      <ParentAlert>
        You have <strong>P1,100</strong> in outstanding fees due this month.{" "}
        <Link href="/parent/pay-tuition" className="font-semibold underline">
          Pay now
        </Link>
      </ParentAlert>

      <MetricGrid>
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </MetricGrid>

      <div className="mb-10 grid gap-5 xl:grid-cols-2">
        <ParentCard
          title="My students"
          icon={Users}
          action={
            <Link href="/parent/enroll" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-black/15 bg-white px-3.5 text-[13px] text-[#6b6b6b] hover:bg-[#f2f1ef]">
              <Plus className="size-4" />
              Add student
            </Link>
          }
          bodyClassName="p-0"
        >
          {children.map((student) => (
            <Link key={student.name} href="/parent/student-profile" className="flex items-center justify-between gap-4 border-b border-black/[0.08] px-5 py-4 last:border-b-0 hover:bg-[#f8f8f7]">
              <div className="flex min-w-0 items-center gap-3">
                <span className={student.tone === "blue" ? "flex size-10 items-center justify-center rounded-[10px] bg-[#e3f2fd] text-lg font-semibold text-[#1565c0]" : "flex size-10 items-center justify-center rounded-[10px] bg-[#fbe9e7] text-lg font-semibold text-[#e64a19]"}>
                  {student.initials}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium text-[#1a1a1a]">{student.name}</div>
                  <div className="mt-0.5 truncate text-xs text-[#6b6b6b]">{student.meta}</div>
                </div>
              </div>
              <StatusPill tone="blue">Enrolled</StatusPill>
            </Link>
          ))}
        </ParentCard>

        <ParentCard
          title="Outstanding fees"
          icon={CalendarClock}
          action={
            <Link href="/parent/pay-tuition" className="inline-flex h-8 items-center rounded-[10px] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white hover:bg-[#bf360c]">
              Pay now
            </Link>
          }
          bodyClassName="p-0"
        >
          {outstandingFees.map((fee) => (
            <FeeRow key={fee.title} {...fee} />
          ))}
        </ParentCard>
      </div>

      <ParentCard title="Recent activity" icon={CalendarClock} action={<ParentButton>View all</ParentButton>} bodyClassName="p-0">
        <ParentTable
          headers={[
            { label: "Date", className: "w-[14%]" },
            { label: "Student", className: "w-[22%]" },
            { label: "Description", className: "w-[28%]" },
            { label: "Amount", className: "w-[14%]" },
            { label: "Channel", className: "w-[12%]" },
            { label: "Status", className: "w-[10%]" },
          ]}
        >
          {recentActivity.map(([date, student, description, amount, channel, status]) => (
            <tr key={`${date}-${description}`}>
              <td>{date}</td>
              <td className="font-medium">{student}</td>
              <td>{description}</td>
              <td className={amount.startsWith("+") ? "font-semibold text-[#2e7d32]" : "font-semibold text-[#1a1a1a]"}>{amount}</td>
              <td>{channel}</td>
              <td><StatusPill tone={status === "Due" ? "red" : "green"}>{status}</StatusPill></td>
            </tr>
          ))}
        </ParentTable>
      </ParentCard>
    </>
  );
}

