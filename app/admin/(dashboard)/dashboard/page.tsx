import { AlertCircle, Calculator, Download, History, Siren } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAdminDashboardRealData } from "@/lib/admin/real-data";

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
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Create tuition fee assignments to show grade collection totals.</div>
          )}
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
          <SummaryRows rows={data.monthlySummary} />
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
            {data.recentPayments.length > 0 ? (
              data.recentPayments.map(([time, student, type, amount, channel, status]) => (
                <tr key={`${time}-${student}-${amount}`}>
                  <td className="font-mono text-[11px] text-[#5a6070]">{time}</td>
                  <td className="font-bold">{student}</td>
                  <td>{type}</td>
                  <td className="font-bold text-[#e64a19]">{amount}</td>
                  <td>{channel}</td>
                  <td className="font-semibold text-[#2e7d32]">{status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center text-[#5a6070]">
                  No payment records yet.
                </td>
              </tr>
            )}
          </AdminTable>
        </DashboardCard>

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

