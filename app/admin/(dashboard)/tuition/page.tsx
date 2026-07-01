import { Calculator, ClipboardList, Receipt, Send } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminTuitionPageRealData } from "@/lib/admin/real-data";
import { getAdminFeeSetupData } from "@/lib/fees/records";
import { FeeManagementForms } from "@/app/admin/fees/fee-management-forms";
import { PaymentReminderHistoryTable } from "./payment-reminder-history-table";
import { PaymentReminderForm } from "./payment-reminder-form";

import {
  AdminTable,
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { TuitionReportTable, type TuitionReportRow } from "./tuition-report-table";

export default async function TuitionPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/tuition");
  const [data, feeSetup] = await Promise.all([
    getAdminTuitionPageRealData(session.userId),
    getAdminFeeSetupData(session.userId, "tuition"),
  ]);
  const tuitionReportRecords: TuitionReportRow[] = data.rows.map((row) => ({
    ...row,
    balance: row.due - row.paid,
  }));

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={Receipt}>{data.warning}</AlertBanner> : null}
      {feeSetup.warning ? <AlertBanner tone="warn" icon={Receipt}>{feeSetup.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard title={`Tuition setup - ${feeSetup.activeSchoolYearName ?? "School year pending"}`} icon={Calculator} className="mb-[18px]">
        <FeeManagementForms category="tuition" redirectPath="/admin/tuition" data={feeSetup} />
      </DashboardCard>

      <DashboardCard
        id="payment-reminders"
        title="Payment reminders"
        icon={Send}
        className="mb-[18px] scroll-mt-24"
        bodyClassName="p-0"
        action={<PaymentReminderForm />}
      >
        <div className="border-b border-black/[0.07] px-[18px] py-3 text-[12.5px] leading-5 text-[#5a6070]">
          Creates queued in-app reminder history for linked parents with open or partial balances. Real email and SMS delivery are still future.
        </div>
        <PaymentReminderHistoryTable rows={data.reminderRows} />
      </DashboardCard>

      <DashboardCard
        title={`Tuition report - ${feeSetup.activeSchoolYearName ?? "School year pending"}`}
        icon={Receipt}
        bodyClassName="p-0"
        className="mb-[18px]"
      >
        <TuitionReportTable rows={tuitionReportRecords} />
      </DashboardCard>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard title="Outstanding by grade" icon={Calculator}>
          {data.outstandingByGrade.length > 0 ? (
            <BarList rows={data.outstandingByGrade} />
          ) : (
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Outstanding balances are pending.</div>
          )}
        </DashboardCard>
        <DashboardCard title="Other fee items" icon={ClipboardList} bodyClassName="p-0">
          <AdminTable
            headers={[
              { label: "Fee type", className: "w-[40%]" },
              { label: "Billed", className: "w-[20%]" },
              { label: "Collected", className: "w-[20%]" },
              { label: "Rate", className: "w-[20%]" },
            ]}
          >
            {data.otherFeeSummary.length > 0 ? (
              data.otherFeeSummary.map(([fee, billed, collected, rate]) => (
                <tr key={fee}>
                  <td className="font-bold">{fee}</td>
                  <td>{billed}</td>
                  <td className="font-semibold text-[#2e7d32]">{collected}</td>
                  <td className="font-bold">{rate}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-[#5a6070]">
                  No other fee records yet.
                </td>
              </tr>
            )}
          </AdminTable>
        </DashboardCard>
      </div>
    </>
  );
}

