import type { ReactNode } from "react";

import { AlertCircle, BarChart3, Calculator, History, Siren } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { getAdminDashboardRealData } from "@/lib/admin/real-data";
import { getAdminFeeSetupData } from "@/lib/fees/records";
import { FeeAssignStudentsForm, FeeCreateTypeForm } from "@/app/admin/fees/fee-management-forms";
import { OtherFeeActionModal } from "@/app/admin/(dashboard)/other-fees/other-fees-management-modal";

import {
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SummaryRows,
  Timeline,
} from "../../_components/admin-ui";
import {
  DashboardRecentTables,
  RecentFeeAssignmentsTable,
  RecentPaymentsTable,
  type RecentFeeAssignmentRow,
  type RecentPaymentRow,
} from "./dashboard-recent-tables";
import { TuitionCollectedByGradeChart } from "./tuition-collected-chart";

export default async function AdminDashboardPage() {
  const session = await requireRole("admin");
  const [data, feeSetup, staffRole] = await Promise.all([
    getAdminDashboardRealData(session.userId),
    getAdminFeeSetupData(session.userId, "tuition"),
    getAdminStaffRole(session.userId),
  ]);
  const canManageFinance = canAccessFinance(staffRole);
  const feeAssignments = data.recentFeeAssignments.map(([time, student, grade, feeType, balance, status]) => ({ time, student, grade, feeType, balance, status }));
  const payments = data.recentPayments.map(([time, student, type, amount, channel, status]) => ({ time, student, type, amount, channel, status }));
  const feeAssignmentAction = canManageFinance ? (
    <DashboardFeeAssignmentActions feeSetup={feeSetup} />
  ) : undefined;

  if (staffRole === "school_administrator") {
    return (
      <SchoolAdministratorDashboard
        data={data}
        feeAssignments={feeAssignments}
        payments={payments}
        feeAssignmentAction={feeAssignmentAction}
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
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Collected tuition appears here after payments. Assigned balances appear below.</div>
          )}
        </DashboardCard>

        <DashboardCard title="Monthly summary" icon={Calculator}>
          <SummaryRows rows={data.monthlySummary} />
        </DashboardCard>
      </div>

      <DashboardRecentTables
        feeAssignments={feeAssignments}
        payments={payments}
        feeAssignmentAction={feeAssignmentAction}
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

function SchoolAdministratorDashboard({
  data,
  feeAssignments,
  payments,
  feeAssignmentAction,
}: {
  data: Awaited<ReturnType<typeof getAdminDashboardRealData>>;
  feeAssignments: RecentFeeAssignmentRow[];
  payments: RecentPaymentRow[];
  feeAssignmentAction?: ReactNode;
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
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Collected tuition appears here after payments. Assigned balances appear below.</div>
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

      <RecentFeeAssignmentsTable rows={feeAssignments} action={feeAssignmentAction} />
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

function DashboardFeeAssignmentActions({ feeSetup }: { feeSetup: Awaited<ReturnType<typeof getAdminFeeSetupData>> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <OtherFeeActionModal
        title={`Assign tuition fee - ${feeSetup.activeSchoolYearName ?? "School year pending"}`}
        description="Choose one tuition fee, select enrolled students, then assign it safely."
        triggerLabel="Assign fee"
        triggerIcon="receipt"
        triggerTone="dark"
        size="wide"
      >
        <FeeAssignStudentsForm category="tuition" redirectPath="/admin/tuition" data={feeSetup} />
      </OtherFeeActionModal>
      <OtherFeeActionModal
        title={`Add tuition fee type - ${feeSetup.activeSchoolYearName ?? "School year pending"}`}
        description="Create reusable tuition fee types before assigning them to students."
        triggerLabel="Add fee type"
        triggerIcon="plus"
        triggerTone="outline"
        size="small"
      >
        <FeeCreateTypeForm category="tuition" redirectPath="/admin/tuition" data={feeSetup} />
      </OtherFeeActionModal>
    </div>
  );
}
