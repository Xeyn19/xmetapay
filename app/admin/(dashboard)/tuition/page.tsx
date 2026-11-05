import Link from "next/link";
import { Calculator, Plus, Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminTuitionPageRealData } from "@/lib/admin/real-data";
import { getAdminFeeSetupData } from "@/lib/fees/records";
import { getAdminSchoolContext } from "@/lib/school/setup";
import { getActiveSchoolEmailTemplates } from "@/lib/email/templates";
import { builtInPaymentReminderTemplates } from "@/lib/email/template-contract";
import { TuitionWorkspaceNav } from "@/app/admin/_components/tuition-workspace-nav";
import { PaymentReminderPanel } from "./payment-reminder-panel";

import { AlertBanner, BarList, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { TuitionReportTable, type TuitionReportRow } from "./tuition-report-table";

export default async function TuitionPage() {
  const session = await requireRole("admin");
  const staffRole = await requireAdminPageAccess(session.userId, "/admin/tuition");
  const [data, feeSetup, schoolContext] = await Promise.all([
    getAdminTuitionPageRealData(session.userId),
    getAdminFeeSetupData(session.userId, "tuition"),
    getAdminSchoolContext(session.userId),
  ]);
  const tuitionReportRecords: TuitionReportRow[] = data.rows.map((row) => ({
    ...row,
    balance: row.due - row.paid,
  }));
  const reminderTemplates = schoolContext.schoolId
    ? await getActiveSchoolEmailTemplates(schoolContext.schoolId)
    : builtInPaymentReminderTemplates;

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={Receipt}>{data.warning}</AlertBanner> : null}
      {feeSetup.warning ? <AlertBanner tone="warn" icon={Receipt}>{feeSetup.warning}</AlertBanner> : null}
      <TuitionWorkspaceNav current="balances" />
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title={`Student tuition balances — ${data.schoolYearName ?? "School year pending"}`}
        icon={Receipt}
        bodyClassName="p-0"
        className="mb-[18px]"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {staffRole === "school_administrator" ? <><Link href="/admin/tuition/assessments/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Receipt className="size-4" />Create assessments</Link><Link href="/admin/tuition/schedules" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border bg-background px-4 text-[13px] font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Plus className="size-4" />Tuition packages &amp; setup</Link></> : null}
          </div>
        }
      >
        <TuitionReportTable
          rows={tuitionReportRecords}
          schoolName={schoolContext.schoolName}
          schoolYearName={data.schoolYearName ?? "School year pending"}
        />
      </DashboardCard>

      <DashboardCard title="Outstanding balances by grade" icon={Calculator} className="mb-[18px]">
        {data.outstandingByGrade.length > 0 ? (
          <BarList rows={data.outstandingByGrade} />
        ) : (
          <div className="text-[12.5px] leading-5 text-muted-foreground">Outstanding balances are pending.</div>
        )}
      </DashboardCard>

      <PaymentReminderPanel
        templates={reminderTemplates}
        activeRows={data.reminderRows}
        archivedRows={data.archivedReminderRows}
      />
    </>
  );
}

