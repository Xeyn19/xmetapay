import { ArrowLeft, Building2, CalendarDays, GraduationCap, ShieldCheck, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getSuperAdminSchoolProfile } from "@/lib/super-admin/records";

export default async function SuperAdminSchoolProfilePage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const selectedSchoolId = Number(schoolId);

  if (!Number.isInteger(selectedSchoolId) || selectedSchoolId <= 0) {
    notFound();
  }

  const profile = await getSuperAdminSchoolProfile(selectedSchoolId);
  if (!profile) {
    notFound();
  }

  const { school, counts } = profile;
  const hasActiveYear = school.activeYear !== null;

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/super-admin/admin-accounts"
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <ArrowLeft className="size-4" />
        Back to school admin accounts
      </Link>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">School profile</p>
              <h2 className="mt-1 text-xl font-bold leading-7 text-foreground sm:text-2xl">{school.name}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {school.code} · {school.activeYear?.name ?? "No active school year"}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
              school.status === "Active"
                ? "bg-[var(--status-success-bg)] text-[var(--status-success-foreground)]"
                : "bg-[var(--status-danger-bg)] text-[var(--status-danger-foreground)]"
            }`}
          >
            {school.status}
          </span>
        </div>

        {school.activeYear ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Active year
            </span>
            <span>{school.activeYear.startsOn} – {school.activeYear.endsOn}</span>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-[var(--status-warning-foreground)]/20 bg-[var(--status-warning-bg)] px-3 py-3 text-[12.5px] leading-5 text-[var(--status-warning-foreground)]">
            This school has no active school year. Current-year student, parent, enrollment, and grade counts are unavailable.
          </div>
        )}
      </section>

      <section aria-label="School population summary" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileMetric
          icon={<ShieldCheck className="size-5" />}
          label="School admins"
          value={counts.adminAccounts}
          note={`${counts.activeAdmins} active · ${counts.pendingAdmins} pending · ${counts.disabledAdmins} disabled`}
        />
        <ProfileMetric
          icon={<GraduationCap className="size-5" />}
          label="Current students"
          value={counts.currentStudents}
          note={hasActiveYear ? "Enrolled in the active school year" : "No active school year"}
        />
        <ProfileMetric
          icon={<Users className="size-5" />}
          label="Current parents"
          value={counts.currentParents}
          note={hasActiveYear ? "Distinct parents linked to current students" : "No active school year"}
        />
        <ProfileMetric
          icon={<UserRound className="size-5" />}
          label="All school records"
          value={counts.totalStudents}
          note={`${counts.totalStudents} students · ${counts.totalParents} linked parents`}
        />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <BreakdownCard title="School admin status" description="Company-managed access for this school.">
          <BreakdownRows
            rows={[
              { label: "Active", count: counts.activeAdmins },
              { label: "Pending", count: counts.pendingAdmins },
              { label: "Disabled", count: counts.disabledAdmins },
            ]}
            emptyMessage="No school admin accounts are linked to this school."
          />
        </BreakdownCard>

        <BreakdownCard
          title="Active-year enrollment"
          description={school.activeYear?.name ?? "No active school year configured."}
        >
          <BreakdownRows
            rows={profile.enrollmentStatuses.map((row) => ({ label: row.label, count: row.count }))}
            emptyMessage={hasActiveYear ? "No enrollment records exist for the active school year." : "Enrollment counts need an active school year."}
          />
        </BreakdownCard>

        <BreakdownCard
          title="Enrolled students by grade"
          description={school.activeYear?.name ?? "No active school year configured."}
        >
          <BreakdownRows
            rows={profile.gradeLevels.map((row) => ({ label: row.name, count: row.count }))}
            emptyMessage={hasActiveYear ? "No enrolled students have grade-level data yet." : "Grade counts need an active school year."}
          />
        </BreakdownCard>
      </div>

      {hasActiveYear && counts.currentParents === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 text-[12.5px] leading-5 text-muted-foreground">
          No parent accounts are linked to currently enrolled students. This aggregate view does not expose student or parent identities.
        </p>
      ) : null}
    </div>
  );
}

function ProfileMetric({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold leading-none text-foreground">{value.toLocaleString()}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">{note}</p>
    </article>
  );
}

function BreakdownCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3.5">
        <h3 className="text-[13px] font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{description}</p>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function BreakdownRows({
  rows,
  emptyMessage,
}: {
  rows: Array<{ label: string; count: number }>;
  emptyMessage: string;
}) {
  const visibleRows = rows.filter((row) => row.count > 0);

  if (visibleRows.length === 0) {
    return <p className="py-4 text-center text-[12.5px] leading-5 text-muted-foreground">{emptyMessage}</p>;
  }

  const total = visibleRows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="grid gap-3">
      {visibleRows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate font-semibold text-foreground">{row.label}</span>
            <span className="shrink-0 font-mono font-bold text-muted-foreground">{row.count.toLocaleString()}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(4, (row.count / total) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
