"use client";

import { useEffect, useId, useState } from "react";
import { ArrowRight, UserPlus, UserRoundPlus, Users, X } from "lucide-react";

import type { AdminStudentRow } from "@/lib/students/records";
import { AdminButton } from "../../_components/admin-ui";
import { BulkStudentEnrollmentModal } from "./bulk-student-enrollment-modal";
import { EnrollExistingStudentModal } from "./enroll-existing-student-modal";
import { SingleStudentEnrollmentModal } from "./single-student-enrollment-modal";

type GradeOption = { id: number; name: string };
type SectionOption = { id: number; gradeLevelId: number; label: string };
type IntakeMode = "choose" | "single" | "batch" | "existing" | null;

export function StudentIntake({
  initialOpen,
  ready,
  gradeOptions,
  sectionOptions,
  existingStudents,
  schoolYearName,
}: {
  initialOpen: boolean;
  ready: boolean;
  gradeOptions: GradeOption[];
  sectionOptions: SectionOption[];
  existingStudents: AdminStudentRow[];
  schoolYearName: string | null;
}) {
  const [mode, setMode] = useState<IntakeMode>(initialOpen ? "choose" : null);
  const titleId = useId();
  const pendingStudentCount = existingStudents.filter((student) => student.enrollmentStatus.toLowerCase() !== "enrolled").length;

  useEffect(() => {
    if (mode !== "choose") return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && closeAll();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  function closeAll() {
    setMode(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("intake")) {
      url.searchParams.delete("intake");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  return (
    <>
      <AdminButton type="button" tone="primary" disabled={!ready} onClick={() => setMode("choose")}>
        <UserPlus className="size-4" />
        Add students
      </AdminButton>

      {mode === "choose" ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
          <button type="button" aria-label="Close add students chooser" className="fixed inset-0 cursor-default" onClick={closeAll} />
          <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-4 py-4 sm:px-5">
              <div>
                <h2 id={titleId} className="flex items-center gap-2 text-[14px] font-bold text-[#0f1117]"><UserPlus className="size-4 text-[#e64a19]" />Add students</h2>
                <p className="mt-1 max-w-xl text-[11.5px] leading-5 text-[#5a6070]">Choose the workflow that matches the student records you have.</p>
              </div>
              <button type="button" onClick={closeAll} aria-label="Close modal" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 text-[#5a6070] hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"><X className="size-4" /></button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
              <IntakeChoice icon={UserPlus} title="Add one new student" description="Quickly create one student record and active-year enrollment." onClick={() => setMode("single")} />
              <IntakeChoice icon={Users} title="Add multiple new students" description="Create a batch with shared class defaults and individual overrides." onClick={() => setMode("batch")} />
              <IntakeChoice icon={UserRoundPlus} title="Enroll existing students" description={`${pendingStudentCount} saved student${pendingStudentCount === 1 ? "" : "s"} available for active-year review.`} onClick={() => setMode("existing")} />
            </div>
          </section>
        </div>
      ) : null}

      <SingleStudentEnrollmentModal open={mode === "single"} onClose={() => setMode("choose")} ready={ready} gradeOptions={gradeOptions} sectionOptions={sectionOptions} />
      <BulkStudentEnrollmentModal open={mode === "batch"} onClose={() => setMode("choose")} ready={ready} gradeOptions={gradeOptions} sectionOptions={sectionOptions} />
      <EnrollExistingStudentModal open={mode === "existing"} onClose={() => setMode("choose")} students={existingStudents} gradeOptions={gradeOptions} sectionOptions={sectionOptions} schoolYearName={schoolYearName} />
    </>
  );
}

function IntakeChoice({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof UserPlus;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-44 flex-col items-start rounded-lg border border-black/[0.09] bg-[#f7f8fa] p-4 text-left transition hover:border-[#e64a19]/35 hover:bg-[#fff8f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25">
      <span className="grid size-10 place-items-center rounded-lg bg-[#fde7e0] text-[#e64a19]"><Icon className="size-5" /></span>
      <span className="mt-4 text-[13px] font-bold text-[#0f1117]">{title}</span>
      <span className="mt-1 text-[11px] leading-5 text-[#5a6070]">{description}</span>
      <span className="mt-auto flex items-center gap-1 pt-3 text-[11.5px] font-bold text-[#e64a19]">Continue <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></span>
    </button>
  );
}
