import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { formatMoney, getAssessmentBatchResult } from "@/lib/fees/assessment-workflow";
import { AdminWorkflowHeader, DashboardCard } from "@/app/admin/_components/admin-ui";

export default async function AssessmentBatchPage({params}:{params:Promise<{reference:string}>}){const session=await requireRole("admin");const {reference}=await params;const batch=await getAssessmentBatchResult(session.userId,decodeURIComponent(reference));if(!batch)notFound();return <><AdminWorkflowHeader backHref="/admin/tuition" backLabel="Tuition report" title="Assessment batch result" description="Review the posted, duplicate, excluded, credit, and net totals for this batch." /><DashboardCard title={batch.reference} icon={Receipt}><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-muted-foreground">Posted</dt><dd className="text-xl font-semibold">{batch.posted}</dd></div><div><dt className="text-xs text-muted-foreground">Duplicates / excluded</dt><dd className="text-xl font-semibold">{batch.duplicates} / {batch.excluded}</dd></div><div><dt className="text-xs text-muted-foreground">Gross / credits</dt><dd className="font-semibold">{formatMoney(batch.gross)} / {formatMoney(batch.credits)}</dd></div><div><dt className="text-xs text-muted-foreground">Net posted</dt><dd className="text-xl font-semibold text-primary">{formatMoney(batch.net)}</dd></div></dl></DashboardCard></>}
