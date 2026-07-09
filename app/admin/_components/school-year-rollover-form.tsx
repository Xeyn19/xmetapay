"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, CheckSquare, Search, X } from "lucide-react";

import { prepareSchoolYearRolloverAction } from "@/app/admin/school-setup/actions";
import { AdminButton, Field, fieldControlClass } from "@/app/admin/_components/admin-ui";
import { cn } from "@/lib/utils";
import type { AdminSchoolRolloverData } from "@/lib/school/setup";

export function SchoolYearRolloverForm({ data }: { data: AdminSchoolRolloverData }) {
  const rolloverYears = useMemo(() => data.years.filter((year) => year.status !== "closed"), [data.years]);
  const defaultSourceYearId = rolloverYears.find((year) => year.status === "active")?.id ?? rolloverYears[0]?.id ?? 0;
  const defaultTargetYearId = rolloverYears.find((year) => year.status === "upcoming")?.id
    ?? rolloverYears.find((year) => year.id !== defaultSourceYearId)?.id
    ?? 0;
  const [sourceYearId, setSourceYearId] = useState(defaultSourceYearId);
  const [targetYearId, setTargetYearId] = useState(defaultTargetYearId);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const duplicateYearNames = useMemo(() => duplicateSchoolYearNames(rolloverYears), [rolloverYears]);
  const visibleStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return data.students.filter((student) => {
      const matchesYear = student.schoolYearId === sourceYearId;
      const haystack = `${student.name} ${student.reference} ${student.className}`.toLowerCase();

      return matchesYear && (!needle || haystack.includes(needle));
    });
  }, [data.students, query, sourceYearId]);
  const targetSections = useMemo(
    () => data.targetSections.filter((section) => section.schoolYearId === targetYearId),
    [data.targetSections, targetYearId],
  );

  function toggleStudent(studentId: number) {
    setSelectedIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  function selectVisible() {
    const visibleIds = visibleStudents.map((student) => student.id);

    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  }

  function clearSelected() {
    setSelectedIds([]);
  }

  if (!data.ready) {
    return (
      <div className="rounded-lg border border-dashed border-black/10 bg-[#f7f8fa] px-4 py-6 text-center">
        <div className="text-[13px] font-bold text-[#0f1117]">Rollover not ready</div>
        <div className="mt-1 text-[12px] leading-5 text-[#5a6070]">
          {data.warning ?? "Add school years, sections, and enrolled students first."}
        </div>
      </div>
    );
  }

  return (
    <form action={prepareSchoolYearRolloverAction} className="grid gap-4">
      <input type="hidden" name="sourceSchoolYearId" value={sourceYearId} />
      {selectedIds.map((studentId) => (
        <input key={studentId} type="hidden" name="studentId" value={studentId} />
      ))}

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="From school year" required>
          <select
            value={sourceYearId}
            onChange={(event) => {
              setSourceYearId(Number(event.target.value));
              setSelectedIds([]);
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
            onChange={(event) => setTargetYearId(Number(event.target.value))}
            className={fieldControlClass}
          >
            {rolloverYears.filter((year) => year.id !== sourceYearId && year.status === "upcoming").map((year) => (
              <option key={year.id} value={year.id}>
                {schoolYearOptionLabel(year, duplicateYearNames)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Target grade and section" required>
        <select name="targetSectionId" required className={fieldControlClass}>
          <option value="">Choose target section</option>
          {targetSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.schoolYearName} - {section.gradeName} - {section.sectionName}
            </option>
          ))}
        </select>
      </Field>

      <div className="rounded-lg border border-black/[0.07] bg-white">
        <div className="grid gap-3 border-b border-black/[0.07] p-3 min-[720px]:grid-cols-[1fr_auto] min-[720px]:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a90a0]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(fieldControlClass, "pl-9")}
              placeholder="Search students..."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectVisible}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5]"
            >
              <CheckSquare className="size-4" />
              Select visible
            </button>
            <button
              type="button"
              onClick={clearSelected}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5]"
            >
              <X className="size-4" />
              Clear
            </button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {visibleStudents.length > 0 ? (
            visibleStudents.map((student) => (
              <label
                key={`${sourceYearId}-${student.id}`}
                className="grid cursor-pointer grid-cols-[auto_1fr] gap-3 border-b border-black/[0.06] px-3 py-3 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                  className="mt-1 size-4 accent-[#e64a19]"
                />
                <span>
                  <span className="block text-[13px] font-bold text-[#0f1117]">{student.name}</span>
                  <span className="mt-0.5 block text-[11px] text-[#5a6070]">
                    {student.className} - {student.reference}
                  </span>
                </span>
              </label>
            ))
          ) : (
            <div className="px-3 py-5 text-center text-[12px] font-semibold text-[#5a6070]">
              No enrolled students match this source year.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
        <p className="text-[12px] text-[#5a6070]">
          {selectedIds.length} selected. Existing target-year enrollments will be skipped.
        </p>
        <AdminButton type="submit" tone="primary" className="min-[460px]:w-auto">
          <ArrowRightLeft className="size-4" />
          Prepare rollover
        </AdminButton>
      </div>
    </form>
  );
}

function duplicateSchoolYearNames(years: AdminSchoolRolloverData["years"]) {
  const counts = new Map<string, number>();

  years.forEach((year) => {
    const key = year.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

function schoolYearOptionLabel(
  year: AdminSchoolRolloverData["years"][number],
  duplicateNames: Set<string>,
) {
  const label = duplicateNames.has(year.name.toLowerCase())
    ? `${year.name} - ${year.startsOn} to ${year.endsOn}`
    : year.name;

  return `${label} (${year.status})`;
}
