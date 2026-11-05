import { GraduationCap } from "lucide-react";

import { AdminWorkflowHeader, AlertBanner } from "@/app/admin/_components/admin-ui";
import { CollegeAcademicSetup } from "@/app/admin/_components/college-academic-setup";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { requireRole } from "@/lib/auth/session";
import { getCollegeAcademicSetupData } from "@/lib/school/academic-offerings";

export default async function AcademicSetupPage({ searchParams }: { searchParams: Promise<{ yearId?: string }> }) {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/school-setup/academics");
  const query = await searchParams;
  const yearId = Number.parseInt(query.yearId ?? "", 10);
  const data = await getCollegeAcademicSetupData(session.userId, Number.isSafeInteger(yearId) && yearId > 0 ? yearId : null);

  return <>
    <AdminWorkflowHeader backHref="/admin/school-setup" backLabel="Back to School setup" title="College academic setup" description="Prepare programs, year levels, academic periods, and sections for active or upcoming school years. Closed years remain available for historical review." />
    {data.educationScope === "basic" ? <AlertBanner tone="warn" icon={GraduationCap}>Enable Higher Education or Both under Academic offerings before managing college academics.</AlertBanner> : null}
    {data.warning ? <AlertBanner tone="warn" icon={GraduationCap}>{data.warning}</AlertBanner> : null}
    {data.educationScope !== "basic" ? <CollegeAcademicSetup data={data} /> : null}
  </>;
}
