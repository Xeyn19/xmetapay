import { AlertCircle, BarChart3, Calculator, History, Siren } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAdminStaffRole } from "@/lib/admin/access";
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
import { RecentPaymentsTable, type RecentPaymentRow } from "./dashboard-recent-tables";
import { TuitionCollectedByGradeChart } from "./tuition-collected-chart";

export default async function AdminDashboardPage() {
  const session = await requireRole("admin");
  const [data, staffRole] = await Promise.all([
    getAdminDashboardRealData(session.userId),
    getAdminStaffRole(session.userId),
  ]);
  const payments = data.recentPayments.map(([time, student, type, amount, channel, status]) => ({ time, student, type, amount, channel, status }));

  if (staffRole === "school_administrator") {
    return (
      <SchoolAdministratorDashboard
        data={data}
        payments={payments}
      />
    );
  }

  return (
    <>
      <DashboardAlerts data={data} />

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
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Collected tuition appears here after payments.</div>
          )}
        </DashboardCard>

        <DashboardCard title="Monthly summary" icon={Calculator}>
          <SummaryRows rows={data.monthlySummary} />
        </DashboardCard>
      </div>

      <div className="mb-[18px]">
        <RecentPaymentsTable rows={payments} />
      </div>

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
function SchoolAdministratorDashboard({
  data,
  payments,
}: {
  data: Awaited<ReturnType<typeof getAdminDashboardRealData>>;
  payments: RecentPaymentRow[];
}) {
  return (
    <>
      <DashboardAlerts data={data} />

      <KpiGrid>
        {data.administratorKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <DashboardCard title="Tuition collected by grade" icon={BarChart3}>
          {data.tuitionByGrade.length > 0 ? (
            <TuitionCollectedByGradeChart rows={data.tuitionByGrade} />
          ) : (
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Collected tuition appears here after payments.</div>
          )}
        </DashboardCard>

        <DashboardCard title="Monthly summary" icon={Calculator}>
          <SummaryRows rows={data.monthlySummary} />
        </DashboardCard>
      </div>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <RecentPaymentsTable rows={payments} />

        <DashboardCard title="Activity feed" icon={History}>
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

function DashboardAlerts({ data }: { data: Awaited<ReturnType<typeof getAdminDashboardRealData>> }) {
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
    </>
  );
}
