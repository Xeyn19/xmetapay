import { AlertTriangle, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStudentPageData } from "@/lib/students/records";
import { getAdminSchoolContext } from "@/lib/school/setup";
import { listPendingGuardianEmails } from "@/lib/students/guardian-email-links";
import { canManageStudents } from "@/lib/admin/permissions";
import { getParentStudentLinkRequests } from "@/lib/parents/student-claims";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { StudentIntake } from "./student-intake";
import { StudentsTable } from "./students-table";
import { PendingGuardianEmails } from "./pending-guardian-emails";
import { StudentLinkRequestsTable } from "../parents/student-link-requests-table";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ intake?: string | string[] }> }) {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/students");
  const [data, query, schoolContext] = await Promise.all([
    getAdminStudentPageData(session.userId),
    searchParams,
    getAdminSchoolContext(session.userId),
  ]);
  const pendingGuardians = schoolContext.schoolId && canManageStudents(schoolContext.staffRole)
    ? await listPendingGuardianEmails(schoolContext.schoolId)
    : [];
  let pendingLinkRequests: Awaited<ReturnType<typeof getParentStudentLinkRequests>> = [];
  let linkRequestWarning: string | null = null;
  if (schoolContext.staffRole === "school_administrator") {
    try {
      pendingLinkRequests = (await getParentStudentLinkRequests(session.userId))
        .filter((request) => request.status === "Pending");
    } catch {
      linkRequestWarning = "Parent-submitted requests are unavailable. Import the Parent student-claim migration and refresh.";
    }
  }

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

      <div id="add-students" className="mb-5 scroll-mt-32">
        <DashboardCard
          title={`Student registry - ${data.activeSchoolYearName ?? "School year pending"}`}
          icon={Users}
          bodyClassName="p-0"
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
          <StudentsTable students={data.students} schoolName={schoolContext.schoolName} schoolYearName={data.activeSchoolYearName ?? "School year pending"} />
        </DashboardCard>
      </div>

      {schoolContext.schoolId && canManageStudents(schoolContext.staffRole) ? (
        <DashboardCard title="Parent connection review" icon={Users} bodyClassName="p-0" className="mb-5">
          {schoolContext.staffRole === "school_administrator" ? (
            <section aria-labelledby="parent-submitted-heading" className="border-b border-border p-4 sm:p-5">
              <h3 id="parent-submitted-heading" className="text-sm font-bold text-foreground">Parent-submitted requests</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">These requests came from a signed-in Parent who entered the student’s exact reference and official name.</p>
              {linkRequestWarning ? <p className="mt-3 text-xs font-semibold text-status-warning-foreground">{linkRequestWarning}</p> : (
                <div className="mt-3 overflow-x-auto"><StudentLinkRequestsTable rows={pendingLinkRequests} returnTo="/admin/students" /></div>
              )}
            </section>
          ) : null}
          <section aria-labelledby="school-recorded-heading" className="p-4 sm:p-5">
            <h3 id="school-recorded-heading" className="text-sm font-bold text-foreground">School-recorded guardian emails</h3>
            <p className="mt-1 mb-3 text-xs leading-5 text-muted-foreground">These were entered by school staff during student enrollment.</p>
            <PendingGuardianEmails rows={pendingGuardians} />
          </section>
        </DashboardCard>
      ) : null}

    </>
  );
}
