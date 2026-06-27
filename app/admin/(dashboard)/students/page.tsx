import { AlertTriangle, UserPlus, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStudentPageData } from "@/lib/students/records";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { StudentEnrollmentForm } from "./student-enrollment-form";
import { StudentsTable } from "./students-table";

export default async function StudentsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/students");
  const data = await getAdminStudentPageData(session.userId);

  return (
    <>
      {data.warning ? (
        <AlertBanner tone="warn" icon={AlertTriangle}>
          {data.warning}
        </AlertBanner>
      ) : null}

      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div id="add-student" className="scroll-mt-32">
        <DashboardCard title="Add student" icon={UserPlus} className="mb-5">
          <StudentEnrollmentForm
            ready={data.ready}
            gradeOptions={data.gradeOptions}
            sectionOptions={data.sectionOptions}
          />
        </DashboardCard>
      </div>

      <DashboardCard
        title={`Student registry - ${data.activeSchoolYearName ?? "School year pending"}`}
        icon={Users}
        bodyClassName="p-0"
      >
        <StudentsTable students={data.students} />
      </DashboardCard>
    </>
  );
}
