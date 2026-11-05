import { Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAssessmentWorkspace } from "@/lib/fees/assessment-workflow";
import { ScheduleManager } from "@/app/admin/tuition-assessments/workflow-forms";
import { AdminWorkflowHeader, AlertBanner } from "@/app/admin/_components/admin-ui";

export default async function TuitionSchedulesPage() {
  const session = await requireRole("admin");
  const workspace = await getAssessmentWorkspace(session.userId);
  return <><AdminWorkflowHeader backHref="/admin/tuition" backLabel="Tuition balances" title="Tuition packages & setup" description="Create versioned tuition packages and approve them before assessment. Approved versions are immutable." />{workspace.warning ? <AlertBanner tone="warn" icon={Receipt}>{workspace.warning}</AlertBanner> : null}<ScheduleManager workspace={workspace} /></>;
}
