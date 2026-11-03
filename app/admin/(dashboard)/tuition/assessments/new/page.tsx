import Link from "next/link";

import { requireRole } from "@/lib/auth/session";
import { getAssessmentWorkspace } from "@/lib/fees/assessment-workflow";
import { AssessmentWizard } from "@/app/admin/tuition-assessments/workflow-forms";
import { AlertBanner, DashboardCard } from "@/app/admin/_components/admin-ui";
import { Receipt } from "lucide-react";

export default async function NewAssessmentPage() {
  const session = await requireRole("admin");
  const workspace = await getAssessmentWorkspace(session.userId);
  return <><div className="mb-4"><Link href="/admin/tuition" className="text-sm font-medium text-[#e64a19]">← Tuition</Link><h1 className="mt-2 text-2xl font-semibold">Create assessments</h1><p className="mt-1 text-sm text-[#666b78]">Select an approved Philippine K–12 or college package, validate students and credits, then post one atomic batch.</p></div>{workspace.warning ? <AlertBanner tone="warn" icon={Receipt}>{workspace.warning}</AlertBanner> : null}<DashboardCard title={`Assessment wizard · ${workspace.schoolYearName ?? "School year pending"}`} icon={Receipt}><AssessmentWizard workspace={workspace} /></DashboardCard></>;
}
