import { CalendarDays, Edit3, Info, Layers3 } from "lucide-react";

import { AlertBanner, AdminTable, DashboardCard, KpiCard, KpiGrid, StatusPill } from "@/app/admin/_components/admin-ui";
import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminSchoolSetupFormData, getAdminSchoolSetupOverview } from "@/lib/school/setup";

import { ManualSchoolSetupForm } from "@/app/admin/_components/manual-school-setup-form";

export default async function AdminSchoolSetupPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/school-setup");
  const [overview, initialData] = await Promise.all([
    getAdminSchoolSetupOverview(session.userId),
    getAdminSchoolSetupFormData(session.userId),
  ]);

  return (
    <div className="grid gap-5">
      {overview.warning ? (
        <AlertBanner tone="warn" icon={Info}>
          {overview.warning}
        </AlertBanner>
      ) : (
        <AlertBanner tone="info" icon={Info}>
          Review every school year here. Live dashboards, enrollment, fees, wallet, store, and reports still use the active year.
        </AlertBanner>
      )}

      <KpiGrid>
        {overview.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard title="School years" icon={CalendarDays}>
        {overview.schoolYears.length > 0 ? (
          <AdminTable
            headers={[
              { label: "School year" },
              { label: "Dates" },
              { label: "Status" },
              { label: "Sections" },
              { label: "Enrollments" },
              { label: "Fee types" },
            ]}
          >
            {overview.schoolYears.map((year) => (
              <tr key={year.id}>
                <td>
                  <div className="font-bold text-[#0f1117]">{year.name}</div>
                  <div className="mt-0.5 text-[11px] text-[#5a6070]">{overview.schoolName}</div>
                </td>
                <td>{year.startsOn} to {year.endsOn}</td>
                <td><StatusPill tone={statusTone(year.status)}>{statusLabel(year.status)}</StatusPill></td>
                <td className="font-bold">{year.sectionCount}</td>
                <td className="font-bold">{year.enrollmentCount}</td>
                <td className="font-bold">{year.feeTypeCount}</td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <EmptyState title="No school years yet" detail="Add at least one school year, then choose one active year." />
        )}
      </DashboardCard>

      <DashboardCard title={`Active year structure${overview.activeYear ? ` - ${overview.activeYear.name}` : ""}`} icon={Layers3}>
        {overview.activeYearGrades.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.activeYearGrades.map((grade) => (
              <div key={grade.name} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3">
                <div className="text-[12.5px] font-bold text-[#0f1117]">{grade.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {grade.sections.filter(Boolean).map((section) => (
                    <span key={`${grade.name}-${section}`} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5a6070] ring-1 ring-black/[0.07]">
                      {section}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={overview.activeYear ? "No active-year sections yet" : "No active year selected"}
            detail={overview.activeYear ? "Add sections for the active year." : "Choose one active school year before adding sections."}
          />
        )}
      </DashboardCard>

      <details className="group overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-3.5 text-[13px] font-bold text-[#0f1117] marker:hidden sm:px-[18px]">
          <span className="flex items-center gap-2">
            <Edit3 className="size-[17px] text-[#e64a19]" />
            Edit school setup
          </span>
          <span className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12px] font-semibold text-[#5a6070] transition group-open:bg-[#f7f8fa]">
            Edit setup
          </span>
        </summary>
        <div className="bg-[#f7f8fa] p-[18px]">
          <ManualSchoolSetupForm initialData={initialData} />
        </div>
      </details>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/10 bg-[#f7f8fa] px-4 py-6 text-center">
      <div className="text-[13px] font-bold text-[#0f1117]">{title}</div>
      <div className="mt-1 text-[12px] leading-5 text-[#5a6070]">{detail}</div>
    </div>
  );
}

function statusTone(status: "upcoming" | "active" | "closed" | undefined) {
  if (status === "active") {
    return "active";
  }

  return status === "upcoming" ? "pending" : "inactive";
}

function statusLabel(status: "upcoming" | "active" | "closed" | undefined) {
  if (status === "active" || status === "closed") {
    return status[0].toUpperCase() + status.slice(1);
  }

  return "Upcoming";
}
