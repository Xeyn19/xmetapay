import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { AlertBanner } from "@/app/admin/_components/admin-ui";
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
    <div className="mb-5">
      <Link href="/admin/school-setup" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">← School setup</Link>
      <h1 className="mt-1 text-2xl font-semibold text-foreground">College academic setup</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Prepare programs, year levels, academic periods, and sections for active or upcoming school years. Closed years remain available for historical review.</p>
    </div>
    {data.educationScope === "basic" ? <AlertBanner tone="warn" icon={GraduationCap}>Enable Higher Education or Both under Academic offerings before managing college academics.</AlertBanner> : null}
    {data.warning ? <AlertBanner tone="warn" icon={GraduationCap}>{data.warning}</AlertBanner> : null}
    {data.educationScope !== "basic" ? <CollegeAcademicSetup data={data} /> : null}
  </>;
}
