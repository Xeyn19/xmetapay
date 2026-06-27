import { AlertCircle, Calculator, Siren } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAdminDashboardRealData } from "@/lib/admin/real-data";

import {
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SummaryRows,
  Timeline,
} from "../../_components/admin-ui";
import { DashboardRecentTables } from "./dashboard-recent-tables";

export default async function AdminDashboardPage() {
  const session = await requireRole("admin");
  const data = await getAdminDashboardRealData(session.userId);

  return (
    <>
      {data.warning ? (
        <AlertBanner tone="warn" icon={AlertCircle}>
          {data.warning}
        </AlertBanner>
      ) : null}
      {data.alerts.map((alert) => (
        <AlertBanner key={alert.message} tone={alert.tone} icon={AlertCircle}>
          {alert.message}
        </AlertBanner>
      ))}

      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-[1fr_1fr]">
        <DashboardCard title="Tuition collected by grade" icon={Siren}>
          {data.tuitionByGrade.length > 0 ? (
            <BarList rows={data.tuitionByGrade} />
          ) : (
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Collected tuition appears here after payments. Assigned balances appear below.</div>
          )}
        </DashboardCard>

        <DashboardCard title="Monthly summary" icon={Calculator}>
          <SummaryRows rows={data.monthlySummary} />
        </DashboardCard>
      </div>

      <DashboardRecentTables
        feeAssignments={data.recentFeeAssignments.map(([time, student, grade, feeType, balance, status]) => ({ time, student, grade, feeType, balance, status }))}
        payments={data.recentPayments.map(([time, student, type, amount, channel, status]) => ({ time, student, type, amount, channel, status }))}
      />

      <div className="grid gap-[18px] xl:grid-cols-[1fr_1fr]">
        <DashboardCard title="Activity feed" icon={Siren}>
          {data.activityFeed.length > 0 ? (
            <Timeline items={data.activityFeed} />
          ) : (
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Notification activity is pending.</div>
          )}
        </DashboardCard>
      </div>
    </>
  );
}

