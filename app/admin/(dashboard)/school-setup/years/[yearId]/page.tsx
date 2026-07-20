import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Layers3 } from "lucide-react";

import { DashboardCard, StatusPill } from "@/app/admin/_components/admin-ui";
import { EditSchoolYearModal } from "@/app/admin/_components/school-setup-management-modals";
import { SchoolYearStructureForm } from "@/app/admin/_components/school-year-structure-form";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { requireRole } from "@/lib/auth/session";
import { getAdminSchoolYearStructure } from "@/lib/school/setup";

export default async function AdminSchoolYearStructurePage({ params }: { params: Promise<{ yearId: string }> }) {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/school-setup");
  const { yearId: rawYearId } = await params;
  const yearId = Number(rawYearId);

  if (!Number.isInteger(yearId) || yearId <= 0) notFound();
  const data = await getAdminSchoolYearStructure(session.userId, yearId);
  if (!data) notFound();

  return (
    <div className="grid gap-5">
      <div>
        <Link href="/admin/school-setup" className="inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-[#5a6070] hover:text-[#e64a19]"><ArrowLeft className="size-4" /> Back to School setup</Link>
        <div className="mt-2 flex flex-col gap-3 rounded-xl border border-black/[0.07] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{data.schoolYear.name}</h2><StatusPill tone={statusTone(data.schoolYear.status)}>{statusLabel(data.schoolYear.status)}</StatusPill></div>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[#5a6070]"><CalendarDays className="size-4 text-[#e64a19]" /> {data.schoolYear.startsOn} to {data.schoolYear.endsOn}</p>
            <p className="mt-1 text-[11px] text-[#7a8296]">{data.schoolName}</p>
          </div>
          <EditSchoolYearModal year={data.schoolYear} />
        </div>
      </div>

      {data.schoolYear.status !== "active" ? (
        <div className="rounded-lg border border-[#1565c0]/15 bg-[#e3f2fd] px-4 py-3 text-[12px] leading-5 text-[#1565c0]">
          You are preparing {statusLabel(data.schoolYear.status).toLowerCase()}-year structure. Normal enrollment and finance writes still use the active year.
        </div>
      ) : null}

      <DashboardCard title="Grade and section structure" icon={Layers3}>
        <SchoolYearStructureForm data={data} />
      </DashboardCard>
    </div>
  );
}

function statusTone(status: "upcoming" | "active" | "closed"): "active" | "pending" | "inactive" { return status === "active" ? "active" : status === "upcoming" ? "pending" : "inactive"; }
function statusLabel(status: "upcoming" | "active" | "closed") { return status[0].toUpperCase() + status.slice(1); }
