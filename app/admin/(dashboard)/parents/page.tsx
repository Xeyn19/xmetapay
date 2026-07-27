import { Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminParentsPageData } from "@/lib/students/records";
import { getAdminSchoolContext } from "@/lib/school/setup";

import { DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { ParentsTable } from "./parents-table";

export default async function ParentsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/parents");
  const [data, schoolContext] = await Promise.all([
    getAdminParentsPageData(session.userId),
    getAdminSchoolContext(session.userId),
  ]);

  return (
    <>
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>
      <DashboardCard title="Parent and guardian contacts" icon={Users} bodyClassName="p-0">
        <ParentsTable rows={data.rows} schoolName={schoolContext.schoolName} schoolYearName={schoolContext.selectedSchoolYear?.name ?? "School year pending"} />
      </DashboardCard>
    </>
  );
}
