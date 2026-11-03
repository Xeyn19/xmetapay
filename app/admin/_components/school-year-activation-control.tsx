"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { activateSchoolYearAction } from "@/app/admin/school-setup/actions";
import { AdminButton, StatusPill } from "@/app/admin/_components/admin-ui";
import type { AdminSchoolSetupOverview } from "@/lib/school/setup";
import type { EducationScope } from "@/lib/school/academic-offerings";

type SchoolYearRow = AdminSchoolSetupOverview["schoolYears"][number];
type ActiveYear = AdminSchoolSetupOverview["activeYear"];

export function SchoolYearActivationControl({
  year,
  activeYear,
  educationScope,
  duplicateName = false,
}: {
  year: SchoolYearRow;
  activeYear: ActiveYear;
  educationScope: EducationScope;
  duplicateName?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (year.status === "active") {
    return <StatusPill tone="active">Current year</StatusPill>;
  }

  if (year.status === "closed") {
    return <span className="text-xs font-semibold text-muted-foreground">Closed</span>;
  }

  const basicReady = year.sectionCount > 0;
  const collegeReady = year.collegePeriodCount > 0 && year.collegeProgramYearCount > 0 && year.collegeSectionCount > 0;
  const structureReady = educationScope === "basic" ? basicReady : educationScope === "higher" ? collegeReady : basicReady && collegeReady;
  const blocked = !structureReady || duplicateName;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Activate year ${year.name}`}
        title="Activate year"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Activate
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`activate-school-year-${year.id}`}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
              <div className="min-w-0">
                <h3 id={`activate-school-year-${year.id}`} className="text-[15px] font-bold text-foreground">
                  Activate {year.name}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This will close the current active year. New records will use this year.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Close activation dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-3 px-4 py-4">
              <InfoRow label="Target year" value={`${year.name} - ${year.startsOn} to ${year.endsOn}`} />
              <InfoRow label="Current year to close" value={activeYear?.name ?? "No active year found"} />
              <InfoRow label="Sections" value={String(year.sectionCount)} />
              {educationScope !== "basic" ? <InfoRow label="College periods / sections" value={`${year.collegePeriodCount} / ${year.collegeSectionCount}`} /> : null}
              <InfoRow label="Enrolled students" value={String(year.enrollmentCount)} />

              {duplicateName ? (
                <div className="flex gap-2 rounded-lg border border-status-danger-foreground/20 bg-status-danger-bg px-3 py-3 text-xs leading-5 text-status-danger-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Rename duplicate school years first so activation is clear.
                </div>
              ) : blocked ? (
                <div className="flex gap-2 rounded-lg border border-status-danger-foreground/20 bg-status-danger-bg px-3 py-3 text-xs leading-5 text-status-danger-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {educationScope === "basic" ? `Add K–12 sections for ${year.name} before activating it.` : educationScope === "higher" ? `Add a college period, program year level, and college section for ${year.name}.` : `Complete both the K–12 and College structures for ${year.name}.`}
                </div>
              ) : year.enrollmentCount === 0 ? (
                <div className="flex gap-2 rounded-lg border border-status-warning-foreground/20 bg-status-warning-bg px-3 py-3 text-xs leading-5 text-status-warning-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  This year has no enrolled students yet. The new dashboard will start empty until students are enrolled or rolled over.
                </div>
              ) : (
                <div className="flex gap-2 rounded-lg border border-status-success-foreground/20 bg-status-success-bg px-3 py-3 text-xs leading-5 text-status-success-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  The required {educationScope === "both" ? "K–12 and College structures are" : "academic structure is"} ready.
                </div>
              )}
            </div>

            <form action={activateSchoolYearAction} className="flex flex-col gap-2 border-t border-border px-4 py-4 min-[420px]:flex-row min-[420px]:justify-end">
              <input type="hidden" name="schoolYearId" value={year.id} />
              <AdminButton type="button" tone="ghost" onClick={() => setOpen(false)} className="min-[420px]:w-auto">
                Cancel
              </AdminButton>
              <AdminButton type="submit" tone="primary" disabled={blocked} className="min-[420px]:w-auto">
                Activate {year.name}
              </AdminButton>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-5">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="text-right font-bold text-foreground">{value}</span>
    </div>
  );
}
