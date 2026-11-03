import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, GraduationCap, Info, Mail, School } from "lucide-react";

import { AlertBanner, AdminTable, DashboardCard, KpiCard, KpiGrid, StatusPill } from "@/app/admin/_components/admin-ui";
import { AddSchoolYearModal, EditSchoolDetailsModal, EditSchoolYearModal } from "@/app/admin/_components/school-setup-management-modals";
import { SchoolYearActivationControl } from "@/app/admin/_components/school-year-activation-control";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { requireRole } from "@/lib/auth/session";
import { getSchoolEmailTemplateLibrary } from "@/lib/email/templates";
import { builtInPaymentReminderTemplates } from "@/lib/email/template-contract";
import { getAdminSchoolContext, getAdminSchoolSetupOverview } from "@/lib/school/setup";
import { EmailTemplateLibrary } from "./email-template-library";
import { updateSchoolEducationScopeAction } from "@/app/admin/school-setup/actions";

export default async function AdminSchoolSetupPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/school-setup");
  const [overview, schoolContext] = await Promise.all([
    getAdminSchoolSetupOverview(session.userId),
    getAdminSchoolContext(session.userId),
  ]);
  const emailTemplateLibrary = schoolContext.schoolId
    ? await getSchoolEmailTemplateLibrary(schoolContext.schoolId)
    : {
        templates: builtInPaymentReminderTemplates,
        warning: "Complete school setup before creating school-specific email templates.",
      };
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

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#fff1ec] text-[#e64a19]"><School className="size-5" /></span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">School identity</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[18px] font-bold text-foreground">{overview.schoolName}</h2>
              <StatusPill tone={overview.warning ? "pending" : overview.schoolStatus === "active" ? "active" : "inactive"}>{overview.warning ? "Setup needs attention" : "Setup ready"}</StatusPill>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Code: <span className="font-mono font-semibold text-foreground">{overview.schoolCode}</span></p>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <EditSchoolDetailsModal schoolName={overview.schoolName} schoolCode={overview.schoolCode} />
          <AddSchoolYearModal />
        </div>
      </section>

      <KpiGrid>{overview.kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}</KpiGrid>

      <DashboardCard title="Academic offerings" icon={School}>
        <form action={updateSchoolEducationScopeAction} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)_auto] lg:items-end">
          <div><h3 className="font-semibold text-foreground">What does this school offer?</h3><p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">Choose Basic Education for K–12, Higher Education for College, or Both for an integrated Philippine school. Existing academic records are never deleted.</p></div>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>School offering</span><select name="educationScope" defaultValue={overview.educationScope} className="min-h-12 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/20"><option value="basic">Basic Education only (K–12)</option><option value="higher">Higher Education only (College)</option><option value="both">Both K–12 and College</option></select></label>
          <button className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Save offering</button>
        </form>
      </DashboardCard>

      <div className="grid gap-5 xl:grid-cols-2">
        {overview.educationScope !== "higher" ? <DashboardCard title="Basic Education (K–12)" icon={BookOpen}>
          <TrackSummary ready={overview.academicTracks.basic.ready} description="Kindergarten, Elementary, Junior High School, and Senior High School use configurable grades and sections." counts={[`${overview.academicTracks.basic.gradeLevels} grade levels`,`${overview.academicTracks.basic.sections} sections`,`${overview.academicTracks.basic.enrollments} active enrollments`]} />
          <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row"><Link href={overview.activeYear ? `/admin/school-setup/years/${overview.activeYear.id}` : "/admin/school-setup"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><ArrowRight className="size-4" />Manage K–12 structure</Link><Link href="/admin/school-setup/rollover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted">Prepare K–12 rollover</Link></div>
        </DashboardCard> : null}
        {overview.educationScope !== "basic" ? <DashboardCard title="Higher Education (College)" icon={GraduationCap}>
          <TrackSummary ready={overview.academicTracks.higher.ready} description="Configure degree programs, year levels, semesters or trimesters, sections, and active-period student placement." counts={[`${overview.academicTracks.higher.programs} programs`,`${overview.academicTracks.higher.periods} periods`,`${overview.academicTracks.higher.sections} sections`,`${overview.academicTracks.higher.enrollments} active enrollments`]} />
          <div className="mt-4"><Link href="/admin/school-setup/academics" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><ArrowRight className="size-4" />Manage college academics</Link></div>
        </DashboardCard> : null}
      </div>

      <DashboardCard title="Email templates" icon={Mail}>
        <EmailTemplateLibrary library={emailTemplateLibrary} />
      </DashboardCard>

      <DashboardCard title="School years" icon={CalendarDays} bodyClassName="p-0">
        {duplicateYearNames.size > 0 ? (
          <div className="m-4 rounded-lg border border-status-warning-foreground/20 bg-status-warning-bg px-3 py-2.5 text-xs text-status-warning-foreground">
            Rename duplicate year labels before activation: {[...duplicateYearNames].join(", ")}.
          </div>
        ) : null}
        {overview.schoolYears.length > 0 ? (
          <>
            <div className="hidden md:block">
              <AdminTable headers={[{ label: "School year" }, { label: "Status" }, { label: "Sections" }, { label: "Enrollments" }, { label: "Fee types" }, { label: "Actions" }]}>
                {overview.schoolYears.map((year) => (
                  <tr key={year.id}>
                    <td><div className="font-bold">{schoolYearDisplayName(year, duplicateYearNames)}</div><div className="mt-1 text-[11px] text-muted-foreground">{year.startsOn} to {year.endsOn}</div></td>
                    <td><StatusPill tone={statusTone(year.status)}>{statusLabel(year.status)}</StatusPill></td>
                    <td className="font-bold">{year.sectionCount}</td>
                    <td className="font-bold">{year.enrollmentCount}</td>
                    <td className="font-bold">{year.feeTypeCount}</td>
                    <td><YearActions year={year} activeYear={overview.activeYear} educationScope={overview.educationScope} duplicateName={duplicateYearNames.has(year.name.toLowerCase())} /></td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {overview.schoolYears.map((year) => (
                <article key={year.id} className="rounded-lg border border-border bg-muted/40 p-4 text-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-bold">{schoolYearDisplayName(year, duplicateYearNames)}</h3><p className="mt-1 text-[11px] text-muted-foreground">{year.startsOn} to {year.endsOn}</p></div>
                    <StatusPill tone={statusTone(year.status)}>{statusLabel(year.status)}</StatusPill>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Count label="Sections" value={year.sectionCount} /><Count label="Students" value={year.enrollmentCount} /><Count label="Fees" value={year.feeTypeCount} />
                  </div>
                  <div className="mt-4"><YearActions year={year} activeYear={overview.activeYear} educationScope={overview.educationScope} duplicateName={duplicateYearNames.has(year.name.toLowerCase())} /></div>
                </article>
              ))}
            </div>
          </>
        ) : <EmptyState title="No school years yet" detail="Add a school year, then create its grade and section structure." />}
      </DashboardCard>

      {overview.educationScope !== "higher" ? <DashboardCard title={`K–12 active year structure${overview.activeYear ? ` - ${overview.activeYear.name}` : ""}`} icon={BookOpen} action={overview.activeYear ? <Link href={`/admin/school-setup/years/${overview.activeYear.id}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-semibold hover:bg-muted">Manage structure <ArrowRight className="size-4" /></Link> : null}>
        {overview.activeYearGrades.some((grade) => grade.sections.some(Boolean)) ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.activeYearGrades.filter((grade) => grade.sections.some(Boolean)).map((grade) => (
              <div key={grade.name} className="rounded-lg border border-border bg-muted/40 p-3 text-foreground">
                <div className="text-[12.5px] font-bold">{grade.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{grade.sections.filter(Boolean).map((section) => <span key={`${grade.name}-${section}`} className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">{section}</span>)}</div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No active-year structure yet" detail="Open the active school year and add its grades and sections." />}
      </DashboardCard> : null}
    </div>
  );
}

function YearActions({ year, activeYear, educationScope, duplicateName }: { year: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["schoolYears"][number]; activeYear: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["activeYear"]; educationScope: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["educationScope"]; duplicateName: boolean }) {
  const manageHref = educationScope === "higher" ? `/admin/school-setup/academics?yearId=${year.id}` : `/admin/school-setup/years/${year.id}`;
  return <div className="flex flex-wrap items-center gap-2"><Link href={manageHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary/30 hover:text-primary">Manage structure</Link><EditSchoolYearModal year={year} /><SchoolYearActivationControl year={year} activeYear={activeYear} educationScope={educationScope} duplicateName={duplicateName} /></div>;
}

function Count({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-background px-2 py-2"><div className="text-sm font-bold text-foreground">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>; }
function TrackSummary({ ready, description, counts }: { ready:boolean; description:string; counts:string[] }) { return <div><div className="flex flex-wrap items-center gap-2"><StatusPill tone={ready ? "active" : "pending"}>{ready ? "Ready" : "Setup needed"}</StatusPill>{counts.map(count=><span key={count} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{count}</span>)}</div><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="m-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center"><div className="text-[13px] font-bold text-foreground">{title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div></div>; }
function statusTone(status: "upcoming" | "active" | "closed"): "active" | "pending" | "inactive" { return status === "active" ? "active" : status === "upcoming" ? "pending" : "inactive"; }
function statusLabel(status: "upcoming" | "active" | "closed") { return status[0].toUpperCase() + status.slice(1); }
function duplicateSchoolYearNames(years: Array<{ name: string }>) { const counts = new Map<string, number>(); years.forEach((year) => { const key = year.name.trim().toLowerCase(); counts.set(key, (counts.get(key) ?? 0) + 1); }); return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name)); }
function schoolYearDisplayName(year: { name: string; startsOn: string; endsOn: string }, duplicateNames: Set<string>) { return duplicateNames.has(year.name.toLowerCase()) ? `${year.name} - ${year.startsOn} to ${year.endsOn}` : year.name; }
