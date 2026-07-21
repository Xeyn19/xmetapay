"use client";

import { useEffect, useId } from "react";
import { UserPlus, X } from "lucide-react";

import { StudentEnrollmentForm } from "./student-enrollment-form";

type GradeOption = { id: number; name: string };
type SectionOption = { id: number; gradeLevelId: number; label: string };

export function SingleStudentEnrollmentModal({
  open,
  onClose,
  ready,
  gradeOptions,
  sectionOptions,
}: {
  open: boolean;
  onClose: () => void;
  ready: boolean;
  gradeOptions: GradeOption[];
  sectionOptions: SectionOption[];
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
      <button type="button" aria-label="Close add one student dialog" className="fixed inset-0 cursor-default" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[calc(100svh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 text-[14px] font-bold text-[#0f1117]"><UserPlus className="size-4 text-[#e64a19]" />Add one new student</h2>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[#5a6070]">Create the student record and enroll the student in the active school year.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 text-[#5a6070] hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          <StudentEnrollmentForm ready={ready} gradeOptions={gradeOptions} sectionOptions={sectionOptions} onCancel={onClose} />
        </div>
      </section>
    </div>
  );
}
