"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, CheckSquare, Search, X } from "lucide-react";

import { prepareSchoolYearRolloverAction } from "@/app/admin/school-setup/actions";
import { AdminButton, Field, fieldControlClass } from "@/app/admin/_components/admin-ui";
import { cn } from "@/lib/utils";
import type { AdminSchoolRolloverData } from "@/lib/school/setup";

type PlacementDecision = "promote" | "repeat" | "skip";

type PlacementRow = {
  studentId: number;
  selected: boolean;
  decision: PlacementDecision;
  targetGradeLevelId: number;
  targetSectionId: number;
  studentType: "new" | "transferee" | "returned";
};

export function SchoolYearRolloverForm({ data }: { data: AdminSchoolRolloverData }) {
  const rolloverYears = useMemo(() => data.years.filter((year) => year.status !== "closed"), [data.years]);
  const defaultSourceYearId = rolloverYears.find((year) => year.status === "active")?.id ?? rolloverYears[0]?.id ?? 0;
  const defaultTargetYearId = rolloverYears.find((year) => year.status === "upcoming")?.id ?? 0;
  const [sourceYearId, setSourceYearId] = useState(defaultSourceYearId);
  const [targetYearId, setTargetYearId] = useState(defaultTargetYearId);
  const [query, setQuery] = useState("");
  const [currentGrade, setCurrentGrade] = useState("all");
  const [currentSection, setCurrentSection] = useState("all");
  const [bulkSectionId, setBulkSectionId] = useState("");
  const [placements, setPlacements] = useState<PlacementRow[]>(() => buildPlacements(data, defaultSourceYearId, defaultTargetYearId));
  const duplicateYearNames = useMemo(() => duplicateSchoolYearNames(rolloverYears), [rolloverYears]);
  const sourceStudents = useMemo(
    () => data.students.filter((student) => student.schoolYearId === sourceYearId),
    [data.students, sourceYearId],
  );
  const targetSections = useMemo(
    () => data.targetSections.filter((section) => section.schoolYearId === targetYearId),
    [data.targetSections, targetYearId],
  );
  const currentGradeOptions = useMemo(
    () => uniqueValues(sourceStudents.map((student) => student.gradeName)),
    [sourceStudents],
  );
  const currentSectionOptions = useMemo(
    () => uniqueValues(sourceStudents
      .filter((student) => currentGrade === "all" || student.gradeName === currentGrade)
      .map((student) => student.sectionName ?? "")
      .filter(Boolean)),
    [currentGrade, sourceStudents],
  );
  const visibleStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sourceStudents.filter((student) => {
      const haystack = `${student.name} ${student.reference} ${student.className}`.toLowerCase();

      return (currentGrade === "all" || student.gradeName === currentGrade)
        && (currentSection === "all" || student.sectionName === currentSection)
        && (!needle || haystack.includes(needle));
    });
  }, [currentGrade, currentSection, query, sourceStudents]);
  const visibleIds = useMemo(() => new Set(visibleStudents.map((student) => student.id)), [visibleStudents]);
  const selectedCount = placements.filter((placement) => placement.selected).length;
  const selectedVisibleCount = placements.filter((placement) => placement.selected && visibleIds.has(placement.studentId)).length;
  const unselectedCount = sourceStudents.length - selectedCount;
  const submittedPlacements = useMemo(
    () => placements.filter((placement) => placement.selected && placement.decision !== "skip"),
    [placements],
  );

  function updatePlacement(studentId: number, patch: Partial<PlacementRow>) {
    setPlacements((current) => current.map((placement) => (
      placement.studentId === studentId ? { ...placement, ...patch } : placement
    )));
  }

  function updateDecision(studentId: number, decision: PlacementDecision) {
    updatePlacement(studentId, decision === "skip"
      ? { selected: false, decision }
      : { selected: true, decision });
  }

  function toggleStudent(studentId: number, selected: boolean) {
    setPlacements((current) => current.map((placement) => (
      placement.studentId === studentId
        ? { ...placement, selected, decision: selected && placement.decision === "skip" ? "promote" : placement.decision }
        : placement
    )));
  }

  function updateGrade(studentId: number, targetGradeLevelId: number) {
    const suggestedSection = targetSections.find((section) => section.gradeLevelId === targetGradeLevelId)?.id ?? 0;
    updatePlacement(studentId, { targetGradeLevelId, targetSectionId: suggestedSection });
  }

  function selectVisible(decision: PlacementDecision) {
    setPlacements((current) => current.map((placement) => (
      visibleIds.has(placement.studentId)
        ? decision === "skip"
          ? { ...placement, selected: false }
          : { ...placement, selected: true, decision }
        : placement
    )));
  }

  function clearSelection() {
    setPlacements((current) => current.map((placement) => ({ ...placement, selected: false })));
  }

  function applyBulkSection() {
    const section = targetSections.find((item) => item.id === Number(bulkSectionId));

    if (!section) {
      return;
    }

    setPlacements((current) => current.map((placement) => (
      visibleIds.has(placement.studentId) && placement.selected
        ? { ...placement, decision: "promote", targetGradeLevelId: section.gradeLevelId, targetSectionId: section.id }
        : placement
    )));
  }

  if (!data.ready) {
    return (
      <div className="rounded-lg border border-dashed border-black/10 bg-[#f7f8fa] px-4 py-6 text-center">
        <div className="text-[13px] font-bold text-[#0f1117]">Promotion review not ready</div>
        <div className="mt-1 text-[12px] leading-5 text-[#5a6070]">
          {data.warning ?? "Add school years, sections, and enrolled students first."}
        </div>
      </div>
    );
  }

  return (
    <form action={prepareSchoolYearRolloverAction} className="grid gap-4">
      <input type="hidden" name="sourceSchoolYearId" value={sourceYearId} />
      <input type="hidden" name="targetSchoolYearId" value={targetYearId} />
      <input type="hidden" name="promotions" value={JSON.stringify(submittedPlacements)} readOnly />

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="From school year" required>
          <select
            value={sourceYearId}
            onChange={(event) => {
              const nextSourceYearId = Number(event.target.value);
              setSourceYearId(nextSourceYearId);
              setPlacements(buildPlacements(data, nextSourceYearId, targetYearId));
              setQuery("");
              setCurrentGrade("all");
              setCurrentSection("all");
              setBulkSectionId("");
            }}
            className={fieldControlClass}
          >
            {rolloverYears.map((year) => (
              <option key={year.id} value={year.id}>
                {schoolYearOptionLabel(year, duplicateYearNames)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To school year" required>
          <select
            value={targetYearId}
            onChange={(event) => {
              const nextTargetYearId = Number(event.target.value);
              setTargetYearId(nextTargetYearId);
              setPlacements(buildPlacements(data, sourceYearId, nextTargetYearId));
              setBulkSectionId("");
            }}
            className={fieldControlClass}
          >
            {rolloverYears
              .filter((year) => year.id !== sourceYearId && year.status === "upcoming")
              .map((year) => (
                <option key={year.id} value={year.id}>
                  {schoolYearOptionLabel(year, duplicateYearNames)}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <div className="rounded-lg border border-[#1565c0]/15 bg-[#e3f2fd] px-3.5 py-3 text-[12px] leading-5 text-[#1565c0]">
        This list contains only students enrolled in the selected source year. Suggested placements use the next grade and keep the current section name when that section exists in the target year. Review every row before saving.
      </div>

      <div className="rounded-lg border border-black/[0.07] bg-white">
        <div className="grid gap-3 border-b border-black/[0.07] p-3 lg:grid-cols-[minmax(220px,1fr)_150px_150px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a90a0]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(fieldControlClass, "pl-9")}
              placeholder="Search students..."
            />
          </label>
          <select value={currentGrade} onChange={(event) => { setCurrentGrade(event.target.value); setCurrentSection("all"); }} className={fieldControlClass}>
            <option value="all">All current grades</option>
            {currentGradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <select value={currentSection} onChange={(event) => setCurrentSection(event.target.value)} className={fieldControlClass}>
            <option value="all">All current sections</option>
            {currentSectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.07] p-3">
          <div className="text-[12px] font-semibold text-[#5a6070]">
            {selectedCount === 1 ? "1 student selected" : `${selectedCount} students selected`} · {unselectedCount} not selected
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => selectVisible("promote")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-[11.5px] font-semibold text-[#5a6070] hover:bg-[#eff1f5]">
              <CheckSquare className="size-3.5" /> Select all visible
            </button>
            <button type="button" onClick={clearSelection} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-[11.5px] font-semibold text-[#5a6070] hover:bg-[#eff1f5]">
              <X className="size-3.5" /> Clear selection
            </button>
          </div>
        </div>
        <div className="grid gap-2 border-b border-black/[0.07] bg-[#f7f8fa] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-[11.5px] leading-5 text-[#5a6070]">Assign one target section to the checked students visible in the current filter.</p>
          <div className="flex flex-col gap-2 min-[460px]:flex-row">
            <select value={bulkSectionId} onChange={(event) => setBulkSectionId(event.target.value)} className={cn(fieldControlClass, "min-[460px]:min-w-64")}>
              <option value="">Choose target section</option>
              {targetSections.map((section) => <option key={section.id} value={section.id}>{section.gradeName} - {section.sectionName}</option>)}
            </select>
            <AdminButton type="button" tone="outline" onClick={applyBulkSection} disabled={!bulkSectionId || selectedVisibleCount === 0}>
              Apply to selected
            </AdminButton>
          </div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-[980px] w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f7f8fa] text-left text-[10px] font-bold uppercase tracking-[0.04em] text-[#9ba3b8]">
                <th className="border-b border-black/[0.07] px-3 py-2.5">Select</th>
                <th className="border-b border-black/[0.07] px-3 py-2.5">Student</th>
                <th className="border-b border-black/[0.07] px-3 py-2.5">Current class</th>
                <th className="border-b border-black/[0.07] px-3 py-2.5">Decision</th>
                <th className="border-b border-black/[0.07] px-3 py-2.5">Student type</th>
                <th className="border-b border-black/[0.07] px-3 py-2.5">Target grade</th>
                <th className="border-b border-black/[0.07] px-3 py-2.5">Target section</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.length > 0 ? visibleStudents.map((student) => {
                const placement = placements.find((item) => item.studentId === student.id) ?? emptyPlacement(student.id);
                const rowSections = targetSections.filter((section) => section.gradeLevelId === placement.targetGradeLevelId);

                return (
                  <tr key={student.id} className="border-b border-black/[0.07] align-middle last:border-b-0">
                    <td className="px-3 py-3">
                      <label className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[#f7f8fa]">
                        <input
                          type="checkbox"
                          checked={placement.selected}
                          onChange={(event) => toggleStudent(student.id, event.target.checked)}
                          aria-label={`Select ${student.name} for rollover`}
                          className="size-4 accent-[#e64a19]"
                        />
                      </label>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-[#0f1117]">{student.name}</div>
                      <div className="font-mono text-[10.5px] text-[#5a6070]">{student.reference}</div>
                    </td>
                    <td className="px-3 py-3 text-[#5a6070]">{student.className || "Class pending"}</td>
                    <td className="px-3 py-3">
                      {placement.selected ? (
                        <select value={placement.decision} onChange={(event) => updateDecision(student.id, event.target.value as PlacementDecision)} className="min-h-10 rounded-lg border border-black/15 bg-white px-2.5 text-[12px] font-semibold">
                          <option value="promote">Promote</option>
                          <option value="repeat">Repeat</option>
                        </select>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#9ba3b8]">Not selected</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!placement.selected ? <span className="text-[11px] font-semibold text-[#9ba3b8]">Not selected</span> : (
                        <select value={placement.studentType} onChange={(event) => updatePlacement(student.id, { studentType: event.target.value as PlacementRow["studentType"] })} className="min-h-10 rounded-lg border border-black/15 bg-white px-2.5 text-[12px] font-semibold">
                          <option value="returned">Returned</option>
                          <option value="new">New</option>
                          <option value="transferee">Transferee</option>
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!placement.selected ? (
                        <span className="text-[11px] font-semibold text-[#9ba3b8]">Not selected</span>
                      ) : (
                        <select value={placement.targetGradeLevelId || ""} onChange={(event) => updateGrade(student.id, Number(event.target.value))} className="min-h-10 rounded-lg border border-black/15 bg-white px-2.5 text-[12px] font-semibold">
                          <option value="">Choose grade</option>
                          {data.targetGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!placement.selected ? (
                        <span className="text-[11px] font-semibold text-[#9ba3b8]">Choose Promote or Repeat first</span>
                      ) : (
                        <select value={placement.targetSectionId || ""} onChange={(event) => updatePlacement(student.id, { targetSectionId: Number(event.target.value) })} disabled={rowSections.length === 0} className="min-h-10 rounded-lg border border-black/15 bg-white px-2.5 text-[12px] font-semibold disabled:bg-[#f2f4f7]">
                          <option value="">{rowSections.length > 0 ? "Choose section" : "Needs review"}</option>
                          {rowSections.map((section) => <option key={section.id} value={section.id}>{section.sectionName}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="px-3 py-8 text-center font-semibold text-[#5a6070]">No enrolled students match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
        <p className="text-[12px] text-[#5a6070]">Only checked students with a Promote or Repeat decision will be enrolled. Unchecked students remain unchanged.</p>
        <AdminButton type="submit" tone="primary" className="min-[460px]:w-auto" disabled={selectedCount === 0}>
          <ArrowRightLeft className="size-4" />
          Save reviewed placements
        </AdminButton>
      </div>
    </form>
  );
}

function buildPlacements(data: AdminSchoolRolloverData, sourceYearId: number, targetYearId: number) {
  const targetSections = data.targetSections.filter((section) => section.schoolYearId === targetYearId);

  return data.students
    .filter((student) => student.schoolYearId === sourceYearId)
    .map((student) => {
      const nextGrade = data.targetGrades.find((grade) => grade.sortOrder > student.gradeSortOrder);
      const targetGrade = nextGrade ?? data.targetGrades.find((grade) => grade.id === student.gradeLevelId);
      const matchingSection = targetSections.find((section) => section.gradeLevelId === targetGrade?.id && section.sectionName === student.sectionName);
      const fallbackSection = targetSections.find((section) => section.gradeLevelId === targetGrade?.id);

      return {
        studentId: student.id,
        selected: false,
        decision: nextGrade ? "promote" : "skip" as PlacementDecision,
        targetGradeLevelId: targetGrade?.id ?? 0,
        targetSectionId: matchingSection?.id ?? fallbackSection?.id ?? 0,
        studentType: "returned" as const,
      };
    });
}

function emptyPlacement(studentId: number): PlacementRow {
  return { studentId, selected: false, decision: "skip", targetGradeLevelId: 0, targetSectionId: 0, studentType: "returned" };
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function duplicateSchoolYearNames(years: AdminSchoolRolloverData["years"]) {
  const counts = new Map<string, number>();
  years.forEach((year) => counts.set(year.name.trim().toLowerCase(), (counts.get(year.name.trim().toLowerCase()) ?? 0) + 1));
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

function schoolYearOptionLabel(year: AdminSchoolRolloverData["years"][number], duplicateNames: Set<string>) {
  const label = duplicateNames.has(year.name.toLowerCase()) ? `${year.name} - ${year.startsOn} to ${year.endsOn}` : year.name;
  return `${label} (${year.status})`;
}
