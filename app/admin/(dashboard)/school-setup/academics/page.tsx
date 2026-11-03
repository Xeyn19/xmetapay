import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAssessmentWorkspace } from "@/lib/fees/assessment-workflow";
import { AcademicSetup } from "@/app/admin/tuition-assessments/workflow-forms";
import { AlertBanner } from "@/app/admin/_components/admin-ui";

export default async function AcademicSetupPage() {
  const session = await requireRole("admin");
  const workspace = await getAssessmentWorkspace(session.userId);
  return <><div className="mb-4"><Link href="/admin/school-setup" className="text-sm font-medium text-[#e64a19]">← School setup</Link><h1 className="mt-2 text-2xl font-semibold">College academic setup</h1><p className="mt-1 text-sm text-[#666b78]">Configure school-owned programs, year levels, and periods. Only the active period accepts new assessment posting.</p></div>{workspace.warning ? <AlertBanner tone="warn" icon={GraduationCap}>{workspace.warning}</AlertBanner> : null}<AcademicSetup workspace={workspace} /></>;
}
