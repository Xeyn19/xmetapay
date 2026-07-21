import { AlertTriangle, UserPlus, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStudentPageData } from "@/lib/students/records";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { StudentIntake } from "./student-intake";
import { StudentsTable } from "./students-table";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ intake?: string | string[] }> }) {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/students");
  const [data, query] = await Promise.all([getAdminStudentPageData(session.userId), searchParams]);

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

      <div id="add-students" className="scroll-mt-32">
        <DashboardCard
          title="Student enrollment"
          icon={UserPlus}
          className="mb-5"
          action={
            <StudentIntake
              initialOpen={query.intake === "choose"}
              ready={data.ready}
              gradeOptions={data.gradeOptions}
              sectionOptions={data.enrollmentSectionOptions}
              existingStudents={data.enrollmentCandidates}
              schoolYearName={data.enrollmentSchoolYearName}
            />
          }
        >
          <p className="max-w-3xl text-[12px] leading-5 text-[#5a6070]">
            Add one student, create a batch of new student records, or enroll students who already exist for the active school year.
          </p>
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
