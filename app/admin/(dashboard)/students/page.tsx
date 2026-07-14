import { AlertTriangle, UserPlus, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStudentPageData } from "@/lib/students/records";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { StudentEnrollmentForm } from "./student-enrollment-form";
import { BulkStudentEnrollmentModal } from "./bulk-student-enrollment-modal";
import { EnrollExistingStudentModal } from "./enroll-existing-student-modal";
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
        <DashboardCard
          title="Add student"
          icon={UserPlus}
          className="mb-5"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <BulkStudentEnrollmentModal
                ready={data.ready}
                gradeOptions={data.gradeOptions}
                sectionOptions={data.enrollmentSectionOptions}
              />
              <EnrollExistingStudentModal
                students={data.enrollmentCandidates}
                gradeOptions={data.gradeOptions}
                sectionOptions={data.enrollmentSectionOptions}
                schoolYearName={data.enrollmentSchoolYearName}
              />
            </div>
          }
        >
          <StudentEnrollmentForm
            ready={data.ready}
            gradeOptions={data.gradeOptions}
            sectionOptions={data.enrollmentSectionOptions}
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
