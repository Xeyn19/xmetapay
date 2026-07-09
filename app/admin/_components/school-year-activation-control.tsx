"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { activateSchoolYearAction } from "@/app/admin/school-setup/actions";
import { AdminButton, StatusPill } from "@/app/admin/_components/admin-ui";
import type { AdminSchoolSetupOverview } from "@/lib/school/setup";

type SchoolYearRow = AdminSchoolSetupOverview["schoolYears"][number];
type ActiveYear = AdminSchoolSetupOverview["activeYear"];

export function SchoolYearActivationControl({
  year,
  activeYear,
  duplicateName = false,
}: {
  year: SchoolYearRow;
  activeYear: ActiveYear;
  duplicateName?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (year.status === "active") {
    return <StatusPill tone="active">Current year</StatusPill>;
  }

  if (year.status === "closed") {
    return <span className="text-[12px] font-semibold text-[#5a6070]">Closed</span>;
  }

  const blocked = year.sectionCount === 0 || duplicateName;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Activate year ${year.name}`}
        title="Activate year"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/10 bg-white px-3 text-[12px] font-bold text-[#0f1117] transition hover:border-[#e64a19]/40 hover:text-[#e64a19] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e64a19]/30"
      >
        Activate
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`activate-school-year-${year.id}`}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-4 py-4">
              <div className="min-w-0">
                <h3 id={`activate-school-year-${year.id}`} className="text-[15px] font-bold text-[#0f1117]">
                  Activate {year.name}
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-[#5a6070]">
                  This will close the current active year. New records will use this year.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#f7f8fa] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e64a19]/30"
                aria-label="Close activation dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-3 px-4 py-4">
              <InfoRow label="Target year" value={`${year.name} - ${year.startsOn} to ${year.endsOn}`} />
              <InfoRow label="Current year to close" value={activeYear?.name ?? "No active year found"} />
              <InfoRow label="Sections" value={String(year.sectionCount)} />
              <InfoRow label="Enrolled students" value={String(year.enrollmentCount)} />

              {duplicateName ? (
                <div className="flex gap-2 rounded-lg border border-[#c62828]/15 bg-[#ffebee] px-3 py-3 text-[12px] leading-5 text-[#c62828]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Rename duplicate school years first so activation is clear.
                </div>
              ) : blocked ? (
                <div className="flex gap-2 rounded-lg border border-[#c62828]/15 bg-[#ffebee] px-3 py-3 text-[12px] leading-5 text-[#c62828]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Add sections for {year.name} before activating it.
                </div>
              ) : year.enrollmentCount === 0 ? (
                <div className="flex gap-2 rounded-lg border border-[#f57c00]/20 bg-[#fff3e0] px-3 py-3 text-[12px] leading-5 text-[#f57c00]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  This year has no enrolled students yet. The new dashboard will start empty until students are enrolled or rolled over.
                </div>
              ) : (
                <div className="flex gap-2 rounded-lg border border-[#2e7d32]/15 bg-[#e8f5e9] px-3 py-3 text-[12px] leading-5 text-[#2e7d32]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  This year has sections and enrolled students ready.
                </div>
              )}
            </div>

            <form action={activateSchoolYearAction} className="flex flex-col gap-2 border-t border-black/[0.07] px-4 py-4 min-[420px]:flex-row min-[420px]:justify-end">
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
    <div className="flex items-start justify-between gap-4 rounded-lg bg-[#f7f8fa] px-3 py-2.5 text-[12px] leading-5">
      <span className="font-semibold text-[#5a6070]">{label}</span>
      <span className="text-right font-bold text-[#0f1117]">{value}</span>
    </div>
  );
}
