import { ClipboardList } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminOtherFeesPageRealData } from "@/lib/admin/real-data";
import { getAdminFeeSetupData } from "@/lib/fees/records";
import { FeeManagementForms } from "@/app/admin/fees/fee-management-forms";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { OtherFeesManagementModal } from "./other-fees-management-modal";
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
        title={`Other school fees - ${feeSetup.activeSchoolYearName ?? "School year pending"}`}
        icon={ClipboardList}
        action={
          <OtherFeesManagementModal title={`Manage other fees - ${feeSetup.activeSchoolYearName ?? "School year pending"}`}>
            <FeeManagementForms category="other" redirectPath="/admin/other-fees" data={feeSetup} />
          </OtherFeesManagementModal>
        }
        bodyClassName="p-0"
      >
        <OtherFeesTable items={data.items} />
      </DashboardCard>
    </>
  );
}

