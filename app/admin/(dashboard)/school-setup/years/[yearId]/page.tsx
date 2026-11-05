import { notFound } from "next/navigation";
import { Layers3 } from "lucide-react";

import { AdminWorkflowHeader, DashboardCard, StatusPill } from "@/app/admin/_components/admin-ui";
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
      <AdminWorkflowHeader backHref="/admin/school-setup" backLabel="Back to School setup" title={data.schoolYear.name} description={`${data.schoolName} · ${data.schoolYear.startsOn} to ${data.schoolYear.endsOn}`} status={<StatusPill tone={statusTone(data.schoolYear.status)}>{statusLabel(data.schoolYear.status)}</StatusPill>} action={<EditSchoolYearModal year={data.schoolYear} />} />

      {data.schoolYear.status !== "active" ? (
        <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg px-4 py-3 text-[12px] leading-5 text-status-info-foreground">
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
