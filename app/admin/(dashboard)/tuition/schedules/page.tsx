import Link from "next/link";
import { Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAssessmentWorkspace } from "@/lib/fees/assessment-workflow";
import { ScheduleManager } from "@/app/admin/tuition-assessments/workflow-forms";
import { AlertBanner } from "@/app/admin/_components/admin-ui";

export default async function TuitionSchedulesPage() {
  const session = await requireRole("admin");
  const workspace = await getAssessmentWorkspace(session.userId);
  return <><div className="mb-4"><Link href="/admin/tuition" className="text-sm font-medium text-[#e64a19]">← Tuition</Link><h1 className="mt-2 text-2xl font-semibold">Manage fee catalog</h1><p className="mt-1 text-sm text-[#666b78]">Create versioned tuition packages and approve them before assessment. Approved versions are immutable.</p></div>{workspace.warning ? <AlertBanner tone="warn" icon={Receipt}>{workspace.warning}</AlertBanner> : null}<ScheduleManager workspace={workspace} /></>;
}
