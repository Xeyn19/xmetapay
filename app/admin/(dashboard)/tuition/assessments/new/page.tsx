import { requireRole } from "@/lib/auth/session";
import { getAssessmentWorkspace } from "@/lib/fees/assessment-workflow";
import { AssessmentWizard } from "@/app/admin/tuition-assessments/workflow-forms";
import { AdminWorkflowHeader, AlertBanner, DashboardCard } from "@/app/admin/_components/admin-ui";
import { Receipt } from "lucide-react";

export default async function NewAssessmentPage() {
  const session = await requireRole("admin");
  const workspace = await getAssessmentWorkspace(session.userId);
  return <><AdminWorkflowHeader backHref="/admin/tuition" backLabel="Tuition balances" title="Create assessments" description="Select an approved Philippine K–12 or college package, validate students and credits, then post one atomic batch." />{workspace.warning ? <AlertBanner tone="warn" icon={Receipt}>{workspace.warning}</AlertBanner> : null}<DashboardCard title={`Assessment wizard · ${workspace.schoolYearName ?? "School year pending"}`} icon={Receipt}><AssessmentWizard workspace={workspace} /></DashboardCard></>;
}
