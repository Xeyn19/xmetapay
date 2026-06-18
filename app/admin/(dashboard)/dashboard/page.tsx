import { AlertCircle, Calculator, Download, History, Siren } from "lucide-react";

import {
  AdminButton,
  AdminTable,
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SummaryRows,
  Timeline,
} from "../../_components/admin-ui";
import {
  activityFeed,
  dashboardKpis,
  monthlySummary,
  recentPayments,
  tuitionCollectedByGrade,
} from "../../_data/admin-dashboard-data";

export default function AdminDashboardPage() {
  return (
    <>
      <AlertBanner tone="danger" icon={AlertCircle}>
        <strong>41 students</strong> have unpaid tuition for June. Total outstanding:{" "}
        <strong>P143,500</strong>. <span className="font-bold text-[#e64a19]">View report</span>
      </AlertBanner>
      <AlertBanner tone="warn" icon={AlertCircle}>
        7 students&apos; allowance wallets are below P50. Parents have been notified automatically.
      </AlertBanner>

      <KpiGrid>
        {dashboardKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-[1fr_1fr]">
        <DashboardCard title="Tuition collected by grade - June" icon={Siren}>
          <BarList rows={tuitionCollectedByGrade} />
        </DashboardCard>

        <DashboardCard
          title="Monthly summary"
          icon={Calculator}
          action={
            <AdminButton>
              <Download className="size-4" />
              Export
            </AdminButton>
          }
        >
          <SummaryRows rows={monthlySummary} />
        </DashboardCard>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-[1fr_1fr]">
        <DashboardCard title="Recent payment activity" icon={History} action={<AdminButton>View all</AdminButton>} bodyClassName="p-0">
          <AdminTable
            headers={[
              { label: "Time", className: "w-[18%]" },
              { label: "Student", className: "w-[22%]" },
              { label: "Type", className: "w-[18%]" },
              { label: "Amount", className: "w-[14%]" },
              { label: "Channel", className: "w-[18%]" },
              { label: "Status", className: "w-[10%]" },
            ]}
          >
            {recentPayments.map(([time, student, type, amount, channel, status]) => (
              <tr key={`${time}-${student}`}>
                <td className="font-mono text-[11px] text-[#5a6070]">{time}</td>
                <td className="font-bold">{student}</td>
                <td>{type}</td>
                <td className="font-bold text-[#e64a19]">{amount}</td>
                <td>{channel}</td>
                <td className="font-semibold text-[#2e7d32]">{status}</td>
              </tr>
            ))}
          </AdminTable>
        </DashboardCard>

        <DashboardCard title="Activity feed" icon={Siren}>
          <Timeline items={activityFeed} />
        </DashboardCard>
      </div>
    </>
  );
}

