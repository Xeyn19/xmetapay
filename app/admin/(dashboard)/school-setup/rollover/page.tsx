import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckSquare, GraduationCap } from "lucide-react";

import { DashboardCard } from "@/app/admin/_components/admin-ui";
import { SchoolYearRolloverForm } from "@/app/admin/_components/school-year-rollover-form";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { requireRole } from "@/lib/auth/session";
import { getAdminSchoolRolloverData } from "@/lib/school/setup";

export default async function AdminSchoolRolloverPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/school-setup");
  const data = await getAdminSchoolRolloverData(session.userId);

  return (
    <div className="grid gap-5">
      <div>
        <Link href="/admin/school-setup" className="inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-[#5a6070] hover:text-[#e64a19]"><ArrowLeft className="size-4" /> Back to School setup</Link>
        <div className="mt-2 rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#fff1ec] text-[#e64a19]"><GraduationCap className="size-5" /></span><div><h2 className="text-lg font-bold">Prepare next year</h2><p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#5a6070]">Review students from one school year and create their placement in an upcoming year. Student identity and historical records stay unchanged.</p></div></div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Step number="1" title="Choose years" detail="Select the source and upcoming target year." />
        <Step number="2" title="Select students" detail="Search and check one or many students." />
        <Step number="3" title="Review placements" detail="Confirm grade, section, and enrollment type." />
      </div>

      <DashboardCard title="Review student placements" icon={CheckSquare}>
        <SchoolYearRolloverForm data={data} />
      </DashboardCard>
    </div>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="flex gap-3 rounded-xl border border-black/[0.07] bg-white p-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e64a19] text-[12px] font-bold text-white">{number}</span><div><div className="text-[12.5px] font-bold">{title}</div><div className="mt-1 text-[11px] leading-4 text-[#5a6070]">{detail}</div></div>{number !== "3" ? <ArrowRight className="ml-auto hidden size-4 text-[#c4c8d2] md:block" /> : null}</div>;
}
