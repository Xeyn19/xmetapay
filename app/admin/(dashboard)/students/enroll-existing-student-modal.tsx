"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Search, UserRoundPlus, X } from "lucide-react";

import type { AdminStudentRow } from "@/lib/students/records";
import { enrollExistingStudentsBatchAction } from "@/app/admin/students/actions";

type Placement = {
  studentId: number;
  selected: boolean;
  gradeLevelId: number;
  sectionId: number;
  studentType: "new" | "transferee" | "returned" | "";
};

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
  const [currentGrade, setCurrentGrade] = useState("all");
  const [currentSection, setCurrentSection] = useState("all");
  const [bulkGradeLevelId, setBulkGradeLevelId] = useState(0);
  const [bulkSectionId, setBulkSectionId] = useState(0);
  const [bulkStudentType, setBulkStudentType] = useState<Placement["studentType"]>("returned");
  const [placements, setPlacements] = useState<Placement[]>(() => pendingStudents.map((student) => ({
    studentId: student.id,
    selected: false,
    gradeLevelId: 0,
    sectionId: 0,
    studentType: "returned",
  })));

  const placementById = useMemo(() => new Map(placements.map((placement) => [placement.studentId, placement])), [placements]);
  const gradeNames = useMemo(() => uniqueValues(pendingStudents.map((student) => student.grade)), [pendingStudents]);
  const sectionNames = useMemo(() => uniqueValues(pendingStudents
    .filter((student) => currentGrade === "all" || student.grade === currentGrade)
    .map((student) => student.section)), [currentGrade, pendingStudents]);

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pendingStudents.filter((student) => {
      const matchesQuery = !normalized
        || `${student.fullName} ${student.studentReference} ${student.grade} ${student.section}`.toLowerCase().includes(normalized);
      const matchesGrade = currentGrade === "all" || student.grade === currentGrade;
      const matchesSection = currentSection === "all" || student.section === currentSection;
      return matchesQuery && matchesGrade && matchesSection;
    });
  }, [currentGrade, currentSection, pendingStudents, query]);
  const visibleIds = useMemo(() => new Set(visibleStudents.map((student) => student.id)), [visibleStudents]);
  const selectedCount = placements.filter((placement) => placement.selected).length;
  const selectedVisibleCount = placements.filter((placement) => placement.selected && visibleIds.has(placement.studentId)).length;
  const incompleteSelectedCount = placements.filter((placement) => placement.selected && (!placement.gradeLevelId || !placement.sectionId)).length;
  const bulkSections = sectionOptions.filter((section) => section.gradeLevelId === bulkGradeLevelId);

  function updatePlacement(studentId: number, patch: Partial<Placement>) {
    setPlacements((current) => current.map((placement) => placement.studentId === studentId ? { ...placement, ...patch } : placement));
  }

  function selectGrade(studentId: number, gradeLevelId: number) {
    updatePlacement(studentId, { gradeLevelId, sectionId: 0 });
  }

  function selectAllVisible() {
    setPlacements((current) => current.map((placement) => visibleIds.has(placement.studentId) ? { ...placement, selected: true } : placement));
  }

  function clearSelection() {
    setPlacements((current) => current.map((placement) => ({ ...placement, selected: false })));
  }

  function applyBulkPlacement() {
    if (!bulkGradeLevelId || !bulkSectionId) {
      return;
    }

    setPlacements((current) => current.map((placement) => (
      placement.selected && visibleIds.has(placement.studentId)
        ? { ...placement, gradeLevelId: bulkGradeLevelId, sectionId: bulkSectionId }
        : placement
    )));
  }

  function applyBulkStudentType() {
    setPlacements((current) => current.map((placement) => (
      placement.selected && visibleIds.has(placement.studentId)
        ? { ...placement, studentType: bulkStudentType }
        : placement
    )));
  }

  function close() {
    setOpen(false);
    setQuery("");
    setCurrentGrade("all");
    setCurrentSection("all");
    setBulkGradeLevelId(0);
    setBulkSectionId(0);
    setBulkStudentType("returned");
    setPlacements(pendingStudents.map((student) => ({ studentId: student.id, selected: false, gradeLevelId: 0, sectionId: 0, studentType: "returned" })));
  }

  const submittedPlacements = useMemo(
    () => placements
      .filter((placement) => placement.selected)
      .map(({ studentId, gradeLevelId, sectionId, studentType }) => ({ studentId, gradeLevelId, sectionId, studentType })),
    [placements],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3.5 text-[12.5px] font-semibold text-[#0f1117] transition hover:border-[#e64a19]/35 hover:bg-[#fff5f2] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
      >
        <UserRoundPlus className="size-4" />
        Enroll existing students
      </button>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
          <button type="button" aria-label="Close enroll existing students dialog" className="fixed inset-0 cursor-default" onClick={close} />
          <section role="dialog" aria-modal="true" aria-labelledby="enroll-existing-title" className="relative flex max-h-[calc(100svh-48px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-4 py-4 sm:px-5">
              <div>
                <h2 id="enroll-existing-title" className="flex items-center gap-2 text-[14px] font-bold text-[#0f1117]"><UserRoundPlus className="size-4 text-[#e64a19]" />Enroll existing students</h2>
                <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[#5a6070]">Select one or more Pending students, assign their {schoolYearName ?? "active year"} placement, then save. Their name, birthday, reference, and parent links stay unchanged.</p>
              </div>
              <button type="button" onClick={close} aria-label="Close modal" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 text-[#5a6070] hover:bg-[#eff1f5]"><X className="size-4" /></button>
            </div>

            <form action={enrollExistingStudentsBatchAction} className="flex min-h-0 flex-col">
              <input type="hidden" name="placements" value={JSON.stringify(submittedPlacements)} readOnly />

              <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="min-w-0 rounded-xl border border-black/[0.08] bg-[#f7f8fa] p-3.5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[12.5px] font-bold text-[#0f1117]">1. Select students</p>
                        <p className="mt-1 text-[11px] text-[#5a6070]">Only checked students will be enrolled.</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#5a6070]">{selectedCount} selected · {pendingStudents.length} pending</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr]">
                      <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ba3b8]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} pl-9`} placeholder="Search name or reference" aria-label="Search pending students" /></label>
                      <select value={currentGrade} onChange={(event) => { setCurrentGrade(event.target.value); setCurrentSection("all"); }} className={fieldClass} aria-label="Filter current grade"><option value="all">All current grades</option>{gradeNames.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select>
                      <select value={currentSection} onChange={(event) => setCurrentSection(event.target.value)} className={fieldClass} aria-label="Filter current section"><option value="all">All current sections</option>{sectionNames.map((section) => <option key={section} value={section}>{section}</option>)}</select>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={selectAllVisible} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-[11.5px] font-semibold text-[#5a6070] hover:bg-[#eff1f5]"><CheckSquare className="size-3.5" />Select all visible</button>
                      <button type="button" onClick={clearSelection} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-[11.5px] font-semibold text-[#5a6070] hover:bg-[#eff1f5]"><X className="size-3.5" />Clear selection</button>
                    </div>
                    <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-black/[0.08] bg-white">
                      {visibleStudents.length > 0 ? visibleStudents.map((student) => {
                        const placement = placementById.get(student.id);
                        const selected = placement?.selected ?? false;
                        const rowSections = sectionOptions.filter((section) => section.gradeLevelId === placement?.gradeLevelId);
                        return (
                          <div key={student.id} className={`grid gap-3 border-b border-black/[0.07] p-3 last:border-b-0 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-center ${selected ? "bg-[#fff8f5]" : ""}`}>
                            <label className="flex min-h-11 min-w-0 items-center gap-3">
                              <input type="checkbox" checked={selected} onChange={(event) => updatePlacement(student.id, { selected: event.target.checked })} aria-label={`Select ${student.fullName} for enrollment`} className="size-4 shrink-0 accent-[#e64a19]" />
                              <span className="min-w-0"><span className="block truncate text-[12px] font-bold text-[#0f1117]">{student.fullName}</span><span className="block truncate text-[10.5px] text-[#5a6070]">{student.studentReference} · {student.grade} - {student.section}</span></span>
                            </label>
                            {selected ? <>
                              <select value={placement?.gradeLevelId || ""} onChange={(event) => selectGrade(student.id, Number(event.target.value))} className={`${fieldClass} lg:min-w-40`} aria-label={`Target grade for ${student.fullName}`}><option value="">Target grade</option>{gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select>
                              <select value={placement?.sectionId || ""} onChange={(event) => updatePlacement(student.id, { sectionId: Number(event.target.value) })} disabled={!placement?.gradeLevelId} className={`${fieldClass} lg:min-w-44`} aria-label={`Target section for ${student.fullName}`}><option value="">Target section</option>{rowSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select>
                              <select value={placement?.studentType || ""} onChange={(event) => updatePlacement(student.id, { studentType: event.target.value as Placement["studentType"] })} className={fieldClass} aria-label={`Student type for ${student.fullName}`}><option value="">Student type</option><option value="new">New</option><option value="transferee">Transferee</option><option value="returned">Returned</option></select>
                            </> : <span className="text-[11px] font-semibold text-[#9ba3b8]">Not selected</span>}
                          </div>
                        );
                      }) : <p className="p-8 text-center text-[11.5px] font-semibold text-[#5a6070]">{pendingStudents.length === 0 ? "No pending students for the active school year." : "No pending students match the current filters."}</p>}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-xl border border-black/[0.08] bg-[#f7f8fa] p-3.5">
                    <p className="text-[12.5px] font-bold text-[#0f1117]">2. Apply a shared placement</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#5a6070]">Use this for students moving into the same grade and section. You can still adjust each selected row.</p>
                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[#737b8d]">Target grade<select value={bulkGradeLevelId || ""} onChange={(event) => { setBulkGradeLevelId(Number(event.target.value)); setBulkSectionId(0); }} className={fieldClass}><option value="">Choose target grade</option>{gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
                      <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[#737b8d]">Target section<select value={bulkSectionId || ""} onChange={(event) => setBulkSectionId(Number(event.target.value))} className={fieldClass} disabled={!bulkGradeLevelId}><option value="">Choose target section</option>{bulkSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
                      <button type="button" onClick={applyBulkPlacement} disabled={!bulkGradeLevelId || !bulkSectionId || selectedVisibleCount === 0} className="min-h-11 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#0f1117] hover:bg-[#fff5f2] disabled:cursor-not-allowed disabled:opacity-50">Apply to selected ({selectedVisibleCount})</button>
                      <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[#737b8d]">Student type<select value={bulkStudentType} onChange={(event) => setBulkStudentType(event.target.value as Placement["studentType"])} className={fieldClass}><option value="returned">Returned</option><option value="new">New</option><option value="transferee">Transferee</option></select></label>
                      <button type="button" onClick={applyBulkStudentType} disabled={selectedVisibleCount === 0} className="min-h-11 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#0f1117] hover:bg-[#fff5f2] disabled:cursor-not-allowed disabled:opacity-50">Apply type to selected ({selectedVisibleCount})</button>
                    </div>
                    <div className="mt-5 rounded-lg border border-[#e64a19]/15 bg-[#fff8f5] p-3 text-[11px] leading-5 text-[#5a6070]">
                      Selected: <strong className="text-[#0f1117]">{selectedCount}</strong>. {selectedCount === 0 ? (
                        "Check one or more students first."
                      ) : selectedVisibleCount === 0 ? (
                        <span className="font-semibold text-[#b42318]">Selected students are hidden by the current filters. Clear or change the filters before applying a shared placement.</span>
                      ) : incompleteSelectedCount > 0 ? (
                        <span className="font-semibold text-[#b42318]">{incompleteSelectedCount} still need a target grade and section. Choose both before saving.</span>
                      ) : (
                        "Every selected student has a placement ready."
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-[11px] leading-5 text-[#5a6070]">Only checked students with complete placements will be enrolled. Existing identity and parent data is preserved.</p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button type="button" onClick={close} className="min-h-11 rounded-lg border border-black/10 px-4 text-[12px] font-semibold text-[#5a6070] hover:bg-[#eff1f5]">Cancel</button>
                  <button type="submit" disabled={selectedCount === 0 || incompleteSelectedCount > 0} className="min-h-11 rounded-lg bg-[#e64a19] px-4 text-[12px] font-bold text-white hover:bg-[#cc3f12] disabled:cursor-not-allowed disabled:opacity-50">Enroll {selectedCount > 0 ? selectedCount : "selected"} student{selectedCount === 1 ? "" : "s"}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter((value) => value && value !== "Not enrolled" && value !== "-"))).sort((a, b) => a.localeCompare(b));
}
