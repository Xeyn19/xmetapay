import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { formatMoney, getAssessmentBatchResult } from "@/lib/fees/assessment-workflow";
import { DashboardCard } from "@/app/admin/_components/admin-ui";

export default async function AssessmentBatchPage({params}:{params:Promise<{reference:string}>}){const session=await requireRole("admin");const {reference}=await params;const batch=await getAssessmentBatchResult(session.userId,decodeURIComponent(reference));if(!batch)notFound();return <><div className="mb-4"><Link href="/admin/tuition" className="text-sm font-medium text-[#e64a19]">← Tuition</Link><h1 className="mt-2 text-2xl font-semibold">Assessment batch result</h1></div><DashboardCard title={batch.reference} icon={Receipt}><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-[#666b78]">Posted</dt><dd className="text-xl font-semibold">{batch.posted}</dd></div><div><dt className="text-xs text-[#666b78]">Duplicates / excluded</dt><dd className="text-xl font-semibold">{batch.duplicates} / {batch.excluded}</dd></div><div><dt className="text-xs text-[#666b78]">Gross / credits</dt><dd className="font-semibold">{formatMoney(batch.gross)} / {formatMoney(batch.credits)}</dd></div><div><dt className="text-xs text-[#666b78]">Net posted</dt><dd className="text-xl font-semibold text-[#e64a19]">{formatMoney(batch.net)}</dd></div></dl></DashboardCard></>}
