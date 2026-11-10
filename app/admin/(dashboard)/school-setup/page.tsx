import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, ChevronDown, GraduationCap, Info, Mail, School } from "lucide-react";

import { AlertBanner, AdminTable, DashboardCard, KpiCard, KpiGrid, StatusPill } from "@/app/admin/_components/admin-ui";
import { SchoolAcademicOfferingControl } from "@/app/admin/_components/school-academic-offering-control";
import { AddSchoolYearModal, EditSchoolDetailsModal, EditSchoolYearModal } from "@/app/admin/_components/school-setup-management-modals";
import { SchoolYearActivationControl } from "@/app/admin/_components/school-year-activation-control";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import { requireRole } from "@/lib/auth/session";
import { getSchoolEmailTemplateLibrary } from "@/lib/email/templates";
import { builtInPaymentReminderTemplates } from "@/lib/email/template-contract";
import { getAdminSchoolContext, getAdminSchoolSetupOverview } from "@/lib/school/setup";
import { EmailTemplateLibrary } from "./email-template-library";

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
  const canManageSetup = canManageSchoolSetup(schoolContext.staffRole);
  const basicEnabled = overview.educationScope !== "higher";
  const upcomingYear = overview.schoolYears.find((year) => year.status === "upcoming") ?? null;
  const activeBasicGrades = overview.activeYearGrades.filter((grade) => grade.sections.some(Boolean));

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
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-button-soft text-primary"><School className="size-5" /></span>
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
        </div>
      </section>

      <KpiGrid>{overview.kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}</KpiGrid>

      <DashboardCard title="School type" icon={School}>
        <SchoolAcademicOfferingControl currentScope={overview.educationScope} canManage={canManageSetup} />
      </DashboardCard>

      <section>
        <h2 className="text-[15px] font-bold text-foreground">Academic setup for the active school year</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Manage only the academic tracks selected for this school. Each track has its own readiness status.</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {basicEnabled ? <DashboardCard title="Basic Education setup" icon={BookOpen}>
          <TrackSummary
            ready={overview.academicTracks.basic.ready}
            readyMessage="K–12 grades and sections are ready for the active school year."
            missingMessage={overview.activeYear ? "Add at least one grade and section to complete K–12 setup." : "Add and activate a school year before setting up grades and sections."}
            metrics={[
              { label: "Grades offered", value: overview.academicTracks.basic.gradeLevels },
              { label: "Active-year sections", value: overview.academicTracks.basic.sections },
              { label: "Currently enrolled", value: overview.academicTracks.basic.enrollments },
            ]}
          />
          <div className="mt-4">
            <Link href={overview.activeYear ? `/admin/school-setup/years/${overview.activeYear.id}` : "/admin/school-setup"} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 min-[420px]:w-auto"><ArrowRight className="size-4" />Manage grades &amp; sections</Link>
          </div>
          {activeBasicGrades.length > 0 ? (
            <details className="group mt-4 rounded-lg border border-border bg-muted/30">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                View grade and section summary
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
                {activeBasicGrades.map((grade) => (
                  <div key={grade.name} className="rounded-lg border border-border bg-background p-3">
                    <div className="text-xs font-bold text-foreground">{grade.name}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{grade.sections.filter(Boolean).map((section) => <span key={`${grade.name}-${section}`} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{section}</span>)}</div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </DashboardCard> : null}
        {overview.educationScope !== "basic" ? <DashboardCard title="Higher Education setup" icon={GraduationCap}>
          <TrackSummary
            ready={overview.academicTracks.higher.ready}
            readyMessage="College programs, periods, and sections are ready for the active school year."
            missingMessage={overview.activeYear ? "Add a program, academic period, and college section to complete College setup." : "Add and activate a school year before setting up College academics."}
            metrics={[
              { label: "Programs", value: overview.academicTracks.higher.programs },
              { label: "Academic periods", value: overview.academicTracks.higher.periods },
              { label: "College sections", value: overview.academicTracks.higher.sections },
              { label: "Currently enrolled", value: overview.academicTracks.higher.enrollments },
            ]}
          />
          <div className="mt-4"><Link href="/admin/school-setup/academics" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 min-[420px]:w-auto"><ArrowRight className="size-4" />Manage college academics</Link></div>
        </DashboardCard> : null}
      </div>

      <DashboardCard
        title="School years"
        icon={CalendarDays}
        bodyClassName="p-0"
        action={canManageSetup ? (
          <div className="grid w-full gap-2 min-[420px]:flex min-[420px]:w-auto min-[420px]:flex-wrap">
            <AddSchoolYearModal triggerTone={basicEnabled && upcomingYear ? "outline" : "primary"} />
            {basicEnabled && upcomingYear ? <Link href="/admin/school-setup/rollover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><ArrowRight className="size-4" />Prepare next school year</Link> : null}
          </div>
        ) : null}
      >
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
        {basicEnabled && canManageSetup && !upcomingYear ? (
          <div className="m-4 rounded-lg border border-status-info-foreground/20 bg-status-info-bg px-3.5 py-3 text-xs leading-5 text-status-info-foreground">
            <span className="font-bold">Preparing for next year?</span> Add an upcoming school year first. You can then review current students and prepare their next grade and section without changing historical enrollment records.
          </div>
        ) : null}
      </DashboardCard>

      <DashboardCard title="Email templates" icon={Mail}>
        <EmailTemplateLibrary library={emailTemplateLibrary} />
      </DashboardCard>
    </div>
  );
}

function YearActions({ year, activeYear, educationScope, duplicateName }: { year: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["schoolYears"][number]; activeYear: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["activeYear"]; educationScope: Awaited<ReturnType<typeof getAdminSchoolSetupOverview>>["educationScope"]; duplicateName: boolean }) {
  const manageHref = educationScope === "higher" ? `/admin/school-setup/academics?yearId=${year.id}` : `/admin/school-setup/years/${year.id}`;
  return <div className="flex flex-wrap items-center gap-2"><Link href={manageHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary/30 hover:text-primary">Manage structure</Link><EditSchoolYearModal year={year} /><SchoolYearActivationControl year={year} activeYear={activeYear} educationScope={educationScope} duplicateName={duplicateName} /></div>;
}

function Count({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-background px-2 py-2"><div className="text-sm font-bold text-foreground">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>; }
function TrackSummary({ ready, readyMessage, missingMessage, metrics }: { ready:boolean; readyMessage:string; missingMessage:string; metrics:Array<{label:string;value:number}> }) { return <div><div className="flex items-start gap-2"><StatusPill tone={ready ? "active" : "pending"}>{ready ? "Ready" : "Setup needed"}</StatusPill><p className="text-xs leading-5 text-muted-foreground">{ready ? readyMessage : missingMessage}</p></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(metric=><div key={metric.label} className="rounded-lg border border-border bg-muted/40 px-3 py-2.5"><div className="text-base font-bold text-foreground">{metric.value}</div><div className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">{metric.label}</div></div>)}</div></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="m-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center"><div className="text-[13px] font-bold text-foreground">{title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div></div>; }
function statusTone(status: "upcoming" | "active" | "closed"): "active" | "pending" | "inactive" { return status === "active" ? "active" : status === "upcoming" ? "pending" : "inactive"; }
function statusLabel(status: "upcoming" | "active" | "closed") { return status[0].toUpperCase() + status.slice(1); }
function duplicateSchoolYearNames(years: Array<{ name: string }>) { const counts = new Map<string, number>(); years.forEach((year) => { const key = year.name.trim().toLowerCase(); counts.set(key, (counts.get(key) ?? 0) + 1); }); return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name)); }
function schoolYearDisplayName(year: { name: string; startsOn: string; endsOn: string }, duplicateNames: Set<string>) { return duplicateNames.has(year.name.toLowerCase()) ? `${year.name} - ${year.startsOn} to ${year.endsOn}` : year.name; }
