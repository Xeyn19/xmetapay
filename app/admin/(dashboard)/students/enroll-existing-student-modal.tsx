"use client";

import { useMemo, useState } from "react";
import { Check, Search, UserRoundPlus, X } from "lucide-react";

import type { AdminStudentRow } from "@/lib/students/records";
import { enrollExistingStudentAction } from "@/app/admin/students/actions";

const fieldClass = "min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-[12px] text-[#0f1117] outline-none focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10";

export function EnrollExistingStudentModal({
  students,
  gradeOptions,
  sectionOptions,
  schoolYearName,
}: {
  students: AdminStudentRow[];
  gradeOptions: Array<{ id: number; name: string }>;
  sectionOptions: Array<{ id: number; gradeLevelId: number; label: string }>;
  schoolYearName: string | null;
}) {
  const pendingStudents = useMemo(
    () => students.filter((student) => student.enrollmentStatus.toLowerCase() !== "enrolled"),
    [students],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(0);
  const [gradeLevelId, setGradeLevelId] = useState(0);
  const [sectionId, setSectionId] = useState(0);

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pendingStudents.filter((student) => !normalized
      || `${student.fullName} ${student.studentReference} ${student.grade} ${student.section}`.toLowerCase().includes(normalized));
  }, [pendingStudents, query]);

  const filteredSections = useMemo(
    () => sectionOptions.filter((section) => section.gradeLevelId === gradeLevelId),
    [gradeLevelId, sectionOptions],
  );

  function close() {
    setOpen(false);
    setQuery("");
    setSelectedId(0);
    setGradeLevelId(0);
    setSectionId(0);
  }

  function selectStudent(studentId: number) {
    setSelectedId(studentId);
  }

  function selectGrade(value: number) {
    setGradeLevelId(value);
    setSectionId(0);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3.5 text-[12.5px] font-semibold text-[#0f1117] transition hover:border-[#e64a19]/35 hover:bg-[#fff5f2] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
      >
        <UserRoundPlus className="size-4" />
        Enroll existing
      </button>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
          <button type="button" aria-label="Close enroll existing student dialog" className="fixed inset-0 cursor-default" onClick={close} />
          <section role="dialog" aria-modal="true" aria-labelledby="enroll-existing-title" className="relative flex max-h-[calc(100svh-48px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-4 py-4 sm:px-5">
              <div>
                <h2 id="enroll-existing-title" className="flex items-center gap-2 text-[14px] font-bold text-[#0f1117]"><UserRoundPlus className="size-4 text-[#e64a19]" />Enroll an existing student</h2>
                <p className="mt-1 text-[11.5px] leading-5 text-[#5a6070]">Choose a student already in the school, then add only their {schoolYearName ?? "active school year"} grade and section.</p>
              </div>
              <button type="button" onClick={close} aria-label="Close modal" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 text-[#5a6070] hover:bg-[#eff1f5]"><X className="size-4" /></button>
            </div>

            <form action={enrollExistingStudentAction} className="flex min-h-0 flex-col">
              <input type="hidden" name="studentId" value={selectedId || ""} />
              <input type="hidden" name="gradeLevelId" value={gradeLevelId || ""} />
              <input type="hidden" name="sectionId" value={sectionId || ""} />

              <div className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="min-w-0 rounded-xl border border-black/[0.08] bg-[#f7f8fa] p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12.5px] font-bold text-[#0f1117]">1. Choose the student</p>
                      <p className="mt-1 text-[11px] text-[#5a6070]">Pending students already have their identity details saved.</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-[#5a6070]">{pendingStudents.length} pending</span>
                  </div>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ba3b8]" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} pl-9`} placeholder="Search name or reference" aria-label="Search pending students" />
                  </label>
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-black/[0.08] bg-white">
                    {visibleStudents.length > 0 ? visibleStudents.map((student) => {
                      const selected = student.id === selectedId;
                      return (
                        <button key={student.id} type="button" onClick={() => selectStudent(student.id)} className={`flex min-h-14 w-full items-center gap-3 border-b border-black/[0.07] px-3 text-left last:border-b-0 ${selected ? "bg-[#fff3ee]" : "hover:bg-[#f7f8fa]"}`}>
                          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${selected ? "bg-[#e64a19] text-white" : "bg-[#fff0eb] text-[#e64a19]"}`}>{selected ? <Check className="size-4" /> : student.fullName.slice(0, 1).toUpperCase()}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-bold text-[#0f1117]">{student.fullName}</span>
                            <span className="block truncate text-[10.5px] text-[#5a6070]">{student.studentReference} · {student.grade} - {student.section}</span>
                          </span>
                        </button>
                      );
                    }) : <p className="p-6 text-center text-[11.5px] font-semibold text-[#5a6070]">{pendingStudents.length === 0 ? "No pending students for this school year." : "No pending students match your search."}</p>}
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-black/[0.08] bg-[#f7f8fa] p-3.5">
                  <p className="text-[12.5px] font-bold text-[#0f1117]">2. Add this year’s placement</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#5a6070]">This does not change the student’s name, birthday, reference, or parent links.</p>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[#737b8d]">Grade <select value={gradeLevelId || ""} onChange={(event) => selectGrade(Number(event.target.value))} className={fieldClass} disabled={!selectedId}><option value="">Choose grade</option>{gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
                    <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[#737b8d]">Section <select value={sectionId || ""} onChange={(event) => setSectionId(Number(event.target.value))} className={fieldClass} disabled={!gradeLevelId}><option value="">Choose section</option>{filteredSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button type="button" onClick={close} className="min-h-11 rounded-lg border border-black/10 px-4 text-[12px] font-semibold text-[#5a6070] hover:bg-[#eff1f5]">Cancel</button>
                <button type="submit" disabled={!selectedId || !gradeLevelId || !sectionId} className="min-h-11 rounded-lg bg-[#e64a19] px-4 text-[12px] font-bold text-white hover:bg-[#cc3f12] disabled:cursor-not-allowed disabled:opacity-50">Enroll student</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
