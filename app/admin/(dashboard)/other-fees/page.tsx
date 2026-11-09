import { randomUUID } from "node:crypto";
import { ClipboardList } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminOtherFeesPageRealData } from "@/lib/admin/real-data";
import { getOtherFeeWorkspace } from "@/lib/fees/other-fees";
import { getAdminSchoolContext } from "@/lib/school/setup";
import { OtherFeeAssignmentForm, OtherFeeTypeForm } from "@/app/admin/fees/other-fee-workflow-forms";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { OtherFeeActionModal } from "./other-fees-management-modal";
import { OtherFeesTable } from "./other-fees-table";

export default async function OtherFeesPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/other-fees");
  const [data, workspace, schoolContext] = await Promise.all([
    getAdminOtherFeesPageRealData(session.userId),
    getOtherFeeWorkspace(session.userId),
    getAdminSchoolContext(session.userId),
  ]);
  const hasFeeTypes = workspace.feeTypes.some((item) => item.status === "active");

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={ClipboardList}>{data.warning}</AlertBanner> : null}
      {workspace.warning ? <AlertBanner tone="warn" icon={ClipboardList}>{workspace.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title={`Other school fees - ${data.schoolYearName ?? "School year pending"}`}
        icon={ClipboardList}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {hasFeeTypes ? <OtherFeeActionModal
              title={`Assign other fee - ${workspace.schoolYear?.name ?? "School year pending"}`}
              description="Create one purpose-specific charge, then choose the eligible students who should receive it."
              triggerLabel="Assign other fee"
              triggerIcon="receipt"
              triggerTone="primary"
              size="wide"
            >
              <OtherFeeAssignmentForm workspace={workspace} submissionToken={randomUUID()} />
            </OtherFeeActionModal> : null}
            <OtherFeeActionModal
              title={`Create fee type - ${workspace.schoolYear?.name ?? "School year pending"}`}
              description="Define the purpose, audience, collection policy, and standard amount before assigning students."
              triggerLabel="Create fee type"
              triggerIcon="plus"
              triggerTone={hasFeeTypes ? "outline" : "primary"}
              size="small"
            >
              <OtherFeeTypeForm workspace={workspace} />
            </OtherFeeActionModal>
            {!hasFeeTypes ? <span className="text-xs text-muted-foreground">Create a fee type before assigning students.</span> : null}
          </div>
        }
        bodyClassName="p-0"
      >
        <OtherFeesTable
          items={data.items}
          schoolName={schoolContext.schoolName}
          schoolYearName={data.schoolYearName ?? "School year pending"}
        />
      </DashboardCard>
    </>
  );
}

