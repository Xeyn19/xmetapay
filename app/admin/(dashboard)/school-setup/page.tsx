import Link from "next/link";
import { ArrowRight, CalendarDays, Info, Layers3, School } from "lucide-react";

import { AlertBanner, AdminTable, DashboardCard, KpiCard, KpiGrid, StatusPill } from "@/app/admin/_components/admin-ui";
import { AddSchoolYearModal, EditSchoolDetailsModal, EditSchoolYearModal } from "@/app/admin/_components/school-setup-management-modals";
import { SchoolYearActivationControl } from "@/app/admin/_components/school-year-activation-control";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { requireRole } from "@/lib/auth/session";
import { getAdminSchoolSetupOverview } from "@/lib/school/setup";

export default async function AdminSchoolSetupPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/school-setup");
  const overview = await getAdminSchoolSetupOverview(session.userId);
  const duplicateYearNames = duplicateSchoolYearNames(overview.schoolYears);

  return (
    <div className="grid gap-5">
      {overview.warning ? (
        <AlertBanner tone="warn" icon={Info}>{overview.warning}</AlertBanner>
      ) : (
        <AlertBanner tone="info" icon={Info}>
          The active year controls new records. Upcoming and closed years remain available for setup and review.
        </AlertBanner>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#fff1ec] text-[#e64a19]"><School className="size-5" /></span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#8a90a0]">School identity</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[18px] font-bold text-[#0f1117]">{overview.schoolName}</h2>
              <StatusPill tone={overview.warning ? "pending" : overview.schoolStatus === "active" ? "active" : "inactive"}>{overview.warning ? "Setup needs attention" : "Setup ready"}</StatusPill>
            </div>
            <p className="mt-0.5 text-[12px] text-[#5a6070]">Code: <span className="font-mono font-semibold">{overview.schoolCode}</span></p>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <EditSchoolDetailsModal schoolName={overview.schoolName} schoolCode={overview.schoolCode} />
          <AddSchoolYearModal />
          <Link href="/admin/school-setup/rollover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/10 bg-[#0f1117] px-4 text-[12px] font-semibold text-white hover:bg-[#262a35] focus:outline-none focus-visible:ring-3 focus-visible:ring-black/20">
            <ArrowRight className="size-4" /> Prepare next year
          </Link>
        </div>
      </section>

      <KpiGrid>{overview.kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}</KpiGrid>

      <DashboardCard title="School years" icon={CalendarDays} bodyClassName="p-0">
        {duplicateYearNames.size > 0 ? (
          <div className="m-4 rounded-lg border border-[#f57c00]/20 bg-[#fff7ed] px-3 py-2.5 text-[12px] text-[#8a4b00]">
            Rename duplicate year labels before activation: {[...duplicateYearNames].join(", ")}.
          </div>
        ) : null}
        {overview.schoolYears.length > 0 ? (
          <>
            <div className="hidden md:block">
              <AdminTable headers={[{ label: "School year" }, { label: "Status" }, { label: "Sections" }, { label: "Enrollments" }, { label: "Fee types" }, { label: "Actions" }]}>
                {overview.schoolYears.map((year) => (
                  <tr key={year.id}>
                    <td><div className="font-bold">{schoolYearDisplayName(year, duplicateYearNames)}</div><div className="mt-1 text-[11px] text-[#5a6070]">{year.startsOn} to {year.endsOn}</div></td>
                    <td><StatusPill tone={statusTone(year.status)}>{statusLabel(year.status)}</StatusPill></td>
                    <td className="font-bold">{year.sectionCount}</td>
                    <td className="font-bold">{year.enrollmentCount}</td>
                    <td className="font-bold">{year.feeTypeCount}</td>
                    <td><YearActions year={year} activeYear={overview.activeYear} duplicateName={duplicateYearNames.has(year.name.toLowerCase())} /></td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {overview.schoolYears.map((year) => (
                <article key={year.id} className="rounded-lg border border-black/[0.08] bg-[#f7f8fa] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-bold">{schoolYearDisplayName(year, duplicateYearNames)}</h3><p className="mt-1 text-[11px] text-[#5a6070]">{year.startsOn} to {year.endsOn}</p></div>
                    <StatusPill tone={statusTone(year.status)}>{statusLabel(year.status)}</StatusPill>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Count label="Sections" value={year.sectionCount} /><Count label="Students" value={year.enrollmentCount} /><Count label="Fees" value={year.feeTypeCount} />
                  </div>
                  <div className="mt-4"><YearActions year={year} activeYear={overview.activeYear} duplicateName={duplicateYearNames.has(year.name.toLowerCase())} /></div>
                </article>
              ))}
            </div>
          </>
        ) : <EmptyState title="No school years yet" detail="Add a school year, then create its grade and section structure." />}
      </DashboardCard>

      <DashboardCard
        title={`Active year structure${overview.activeYear ? ` - ${overview.activeYear.name}` : ""}`}
        icon={Layers3}
        action={overview.activeYear ? <Link href={`/admin/school-setup/years/${overview.activeYear.id}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-black/10 px-3 text-[12px] font-semibold hover:bg-[#f7f8fa]">Manage structure <ArrowRight className="size-4" /></Link> : null}
      >
        {overview.activeYearGrades.some((grade) => grade.sections.some(Boolean)) ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.activeYearGrades.filter((grade) => grade.sections.some(Boolean)).map((grade) => (
              <div key={grade.name} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3">
                <div className="text-[12.5px] font-bold">{grade.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{grade.sections.filter(Boolean).map((section) => <span key={`${grade.name}-${section}`} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5a6070] ring-1 ring-black/[0.07]">{section}</span>)}</div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No active-year structure yet" detail="Open the active school year and add its grades and sections." />}
      </DashboardCard>
    </div>
  );
}

function YearActions({ year, activeYear, duplicateName }: { year: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["schoolYears"][number]; activeYear: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["activeYear"]; duplicateName: boolean }) {
  return <div className="flex flex-wrap items-center gap-2"><Link href={`/admin/school-setup/years/${year.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold hover:border-[#e64a19]/30 hover:text-[#e64a19]">Manage structure</Link><EditSchoolYearModal year={year} /><SchoolYearActivationControl year={year} activeYear={activeYear} duplicateName={duplicateName} /></div>;
}

function Count({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-white px-2 py-2"><div className="text-sm font-bold">{value}</div><div className="text-[10px] text-[#7a8296]">{label}</div></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="m-4 rounded-lg border border-dashed border-black/10 bg-[#f7f8fa] px-4 py-6 text-center"><div className="text-[13px] font-bold">{title}</div><div className="mt-1 text-[12px] leading-5 text-[#5a6070]">{detail}</div></div>; }
function statusTone(status: "upcoming" | "active" | "closed"): "active" | "pending" | "inactive" { return status === "active" ? "active" : status === "upcoming" ? "pending" : "inactive"; }
function statusLabel(status: "upcoming" | "active" | "closed") { return status[0].toUpperCase() + status.slice(1); }
function duplicateSchoolYearNames(years: Array<{ name: string }>) { const counts = new Map<string, number>(); years.forEach((year) => { const key = year.name.trim().toLowerCase(); counts.set(key, (counts.get(key) ?? 0) + 1); }); return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name)); }
function schoolYearDisplayName(year: { name: string; startsOn: string; endsOn: string }, duplicateNames: Set<string>) { return duplicateNames.has(year.name.toLowerCase()) ? `${year.name} - ${year.startsOn} to ${year.endsOn}` : year.name; }
