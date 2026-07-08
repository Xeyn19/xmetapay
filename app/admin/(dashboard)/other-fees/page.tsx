import { ClipboardList } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminOtherFeesPageRealData } from "@/lib/admin/real-data";
import { getAdminFeeSetupData } from "@/lib/fees/records";
import { FeeAssignStudentsForm, FeeCreateTypeForm } from "@/app/admin/fees/fee-management-forms";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { OtherFeeActionModal } from "./other-fees-management-modal";
import { OtherFeesTable } from "./other-fees-table";

export default async function OtherFeesPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/other-fees");
  const [data, feeSetup] = await Promise.all([
    getAdminOtherFeesPageRealData(session.userId),
    getAdminFeeSetupData(session.userId, "other"),
  ]);

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={ClipboardList}>{data.warning}</AlertBanner> : null}
      {feeSetup.warning ? <AlertBanner tone="warn" icon={ClipboardList}>{feeSetup.warning}</AlertBanner> : null}
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
            <OtherFeeActionModal
              title={`Assign other fee - ${feeSetup.activeSchoolYearName ?? "School year pending"}`}
              description="Choose one fee type, select enrolled students, then assign it safely."
              triggerLabel="Assign fee"
              triggerIcon="receipt"
              triggerTone="dark"
              size="wide"
            >
              <FeeAssignStudentsForm category="other" redirectPath="/admin/other-fees" data={feeSetup} />
            </OtherFeeActionModal>
            <OtherFeeActionModal
              title={`Add other fee type - ${feeSetup.activeSchoolYearName ?? "School year pending"}`}
              description="Create reusable other-fee types before assigning them to students."
              triggerLabel="Add fee type"
              triggerIcon="plus"
              triggerTone="outline"
              size="small"
            >
              <FeeCreateTypeForm category="other" redirectPath="/admin/other-fees" data={feeSetup} />
            </OtherFeeActionModal>
          </div>
        }
        bodyClassName="p-0"
      >
        <OtherFeesTable items={data.items} />
      </DashboardCard>
    </>
  );
}

