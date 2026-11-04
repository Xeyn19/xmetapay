import { UserRoundCheck, Users, TriangleAlert } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminParentsPageData } from "@/lib/students/records";
import { getAdminSchoolContext } from "@/lib/school/setup";
import { getParentRegistrationRequests, ParentRegistrationReviewError } from "@/lib/parents/registration-approval";
import { getParentStudentLinkRequests } from "@/lib/parents/student-claims";

import { AlertBanner, DashboardCard, KpiCard, KpiGrid } from "../../_components/admin-ui";
import { ParentsTable } from "./parents-table";
import { RegistrationRequestsTable } from "./registration-requests-table";
import { StudentLinkRequestsTable } from "./student-link-requests-table";

export default async function ParentsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/parents");
  const [data, schoolContext] = await Promise.all([
    getAdminParentsPageData(session.userId),
    getAdminSchoolContext(session.userId),
  ]);
  const canReviewRegistrations = schoolContext.staffRole === "school_administrator";
  let requests: Awaited<ReturnType<typeof getParentRegistrationRequests>> = [];
  let registrationWarning: string | null = null;
  let linkRequests: Awaited<ReturnType<typeof getParentStudentLinkRequests>> = [];
  if (canReviewRegistrations) {
    try {
      requests = await getParentRegistrationRequests(session.userId);
      linkRequests = await getParentStudentLinkRequests(session.userId);
    } catch (error) {
      registrationWarning = error instanceof ParentRegistrationReviewError
        ? error.message
        : "Parent review requests are unavailable. Import the Parent registration and student-claim migrations, then check MySQL/XAMPP.";
    }
  }
  const pendingCount = requests.filter((request) => request.status === "Pending approval").length;

  return (
    <>
      <KpiGrid>
        {data.kpis.map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            {...(canReviewRegistrations && index === 3
              ? { label: "Pending approval", value: registrationWarning ? "Unavailable" : String(pendingCount), note: "School-wide registration requests", tone: "blue" as const }
              : kpi)}
          />
        ))}
      </KpiGrid>
      {canReviewRegistrations ? (
        <>
          {registrationWarning ? <AlertBanner tone="warn" icon={TriangleAlert}>{registrationWarning}</AlertBanner> : null}
          <DashboardCard title="Parent registration requests" icon={UserRoundCheck} bodyClassName="p-0" className="mb-5">
            <RegistrationRequestsTable rows={requests} />
          </DashboardCard>
          <DashboardCard title="Student connection requests" icon={UserRoundCheck} bodyClassName="p-0" className="mb-5">
            <StudentLinkRequestsTable rows={linkRequests} />
          </DashboardCard>
        </>
      ) : null}
      <DashboardCard title="Parent and guardian contacts" icon={Users} bodyClassName="p-0">
        <ParentsTable rows={data.rows} schoolName={schoolContext.schoolName} schoolYearName={schoolContext.selectedSchoolYear?.name ?? "School year pending"} />
      </DashboardCard>
    </>
  );
}
