import { ArrowRight, CheckSquare } from "lucide-react";

import { AdminWorkflowHeader, DashboardCard } from "@/app/admin/_components/admin-ui";
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
      <AdminWorkflowHeader backHref="/admin/school-setup" backLabel="Back to School setup" title="Prepare next year" description="Review students from one school year and create their placement in an upcoming year. Student identity and historical records stay unchanged." />

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
  return <div className="flex gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[12px] font-bold text-primary-foreground">{number}</span><div><div className="text-[12.5px] font-bold text-foreground">{title}</div><div className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</div></div>{number !== "3" ? <ArrowRight className="ml-auto hidden size-4 text-muted-foreground md:block" /> : null}</div>;
}
