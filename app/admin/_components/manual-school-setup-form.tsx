"use client";

import { Plus, Save, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

import { saveSchoolSetupAction } from "@/app/admin/school-setup/actions";
import { AdminButton, Field, fieldControlClass } from "@/app/admin/_components/admin-ui";
import { cn } from "@/lib/utils";
import type { AdminSchoolSetupFormData } from "@/lib/school/setup";

type GradeRow = {
  id: string;
  name: string;
  sections: string[];
};

type SchoolYearRow = {
  id: string;
  databaseId: number | null;
  name: string;
  startsOn: string;
  endsOn: string;
  status: "upcoming" | "active" | "closed";
};

export function ManualSchoolSetupForm({
  initialData,
  redirectTo = "/admin/school-setup",
}: {
  initialData: AdminSchoolSetupFormData;
  redirectTo?: string;
}) {
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>(
    initialData.schoolYears.map((year, index) => ({
      id: `school-year-${index}-${year.name || "new"}`,
      databaseId: year.id,
      name: year.name,
      startsOn: year.startsOn,
      endsOn: year.endsOn,
      status: year.status,
    })),
  );
  const [grades, setGrades] = useState<GradeRow[]>(
    initialData.grades.map((grade, index) => ({
      id: `grade-${index}-${grade.name || "new"}`,
      name: grade.name,
      sections: grade.sections.length > 0 ? grade.sections : [""],
    })),
  );
  const gradeSetup = useMemo(
    () => JSON.stringify(grades.map(({ name, sections }) => ({ name, sections }))),
    [grades],
  );
  const selectedSetupSchoolYearId = initialData.selectedSetupSchoolYearId
    ?? schoolYears.find((year) => year.status === "active")?.databaseId
    ?? schoolYears[0]?.databaseId
    ?? "";
  const schoolYearSetup = useMemo(
    () => JSON.stringify(schoolYears.map(({ name, startsOn, endsOn, status }) => ({ name, startsOn, endsOn, status }))),
    [schoolYears],
  );

  function updateSchoolYear(index: number, field: "name" | "startsOn" | "endsOn", value: string) {
    setSchoolYears((current) => current.map((year, yearIndex) => yearIndex === index ? { ...year, [field]: value } : year));
  }

  function updateSchoolYearStatus(index: number, status: "upcoming" | "closed") {
    setSchoolYears((current) => current.map((year, yearIndex) => yearIndex === index ? { ...year, status } : year));
  }

  function setActiveSchoolYear(index: number) {
    setSchoolYears((current) => current.map((year, yearIndex) => ({
      ...year,
      status: yearIndex === index ? "active" : (year.status === "active" ? "upcoming" : year.status),
    })));
  }

  function addSchoolYear() {
    setSchoolYears((current) => [...current, { id: `school-year-${Date.now()}`, databaseId: null, name: "", startsOn: "", endsOn: "", status: "upcoming" }]);
  }

  function removeSchoolYear(index: number) {
    setSchoolYears((current) => {
      if (current.length === 1) {
        return current;
      }

      const next = current.filter((_, yearIndex) => yearIndex !== index);

      return next.some((year) => year.status === "active")
        ? next
        : next.map((year, yearIndex) => yearIndex === 0 ? { ...year, status: "active" } : year);
    });
  }

  function updateGrade(index: number, name: string) {
    setGrades((current) => current.map((grade, gradeIndex) => gradeIndex === index ? { ...grade, name } : grade));
  }

  function addGrade() {
    setGrades((current) => [...current, { id: `grade-${Date.now()}`, name: "", sections: [""] }]);
  }

  function removeGrade(index: number) {
    setGrades((current) => current.length > 1 ? current.filter((_, gradeIndex) => gradeIndex !== index) : current);
  }

  function updateSection(gradeIndex: number, sectionIndex: number, value: string) {
    setGrades((current) => current.map((grade, currentGradeIndex) => {
      if (currentGradeIndex !== gradeIndex) {
        return grade;
      }

      return {
        ...grade,
        sections: grade.sections.map((section, currentSectionIndex) => currentSectionIndex === sectionIndex ? value : section),
      };
    }));
  }

  function addSection(gradeIndex: number) {
    setGrades((current) => current.map((grade, currentGradeIndex) => (
      currentGradeIndex === gradeIndex
        ? { ...grade, sections: [...grade.sections, ""] }
        : grade
    )));
  }

  function removeSection(gradeIndex: number, sectionIndex: number) {
    setGrades((current) => current.map((grade, currentGradeIndex) => {
      if (currentGradeIndex !== gradeIndex || grade.sections.length === 1) {
        return grade;
      }

      return {
        ...grade,
        sections: grade.sections.filter((_, currentSectionIndex) => currentSectionIndex !== sectionIndex),
      };
    }));
  }

  function applyGradeTemplate() {
    setGrades(Array.from({ length: 10 }, (_, index) => ({
      id: `template-grade-${index + 1}`,
      name: `Grade ${index + 1}`,
      sections: ["Section A"],
    })));
  }

  function addSectionAToAll() {
    setGrades((current) => current.map((grade) => (
      grade.sections.some((section) => section.trim().toLowerCase() === "section a")
        ? grade
        : { ...grade, sections: [...grade.sections.filter(Boolean), "Section A"] }
    )));
  }

  return (
    <form action={saveSchoolSetupAction} className="grid gap-5">
      <input type="hidden" name="schoolYearSetup" value={schoolYearSetup} />
      <input type="hidden" name="gradeSetup" value={gradeSetup} />
      <input type="hidden" name="sectionSchoolYearId" value={selectedSetupSchoolYearId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <div className="border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
          <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">School</h2>
        </div>
        <div className="grid gap-3 p-[18px] md:grid-cols-[1fr_220px]">
          <Field label="School name" required>
            <input
              name="schoolName"
              defaultValue={initialData.schoolName}
              required
              className={fieldControlClass}
              placeholder="School name"
            />
          </Field>
          <Field label="School code" required>
            <input
              name="schoolCode"
              defaultValue={initialData.schoolCode}
              required
              className={fieldControlClass}
              placeholder="SCHOOL-CODE"
            />
          </Field>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between sm:px-[18px]">
          <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">School years</h2>
          <AdminButton type="button" tone="outline" className="justify-self-start" onClick={addSchoolYear}>
            <Plus className="size-4" />
            Add year
          </AdminButton>
        </div>
        <div className="grid gap-3 p-[18px]">
          {schoolYears.map((year, yearIndex) => (
            <div key={year.id} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3">
              <div className="grid gap-3 min-[860px]:grid-cols-[1fr_150px_150px_130px_auto] min-[860px]:items-end">
                <Field label={`Year ${yearIndex + 1}`} required>
                  <input
                    value={year.name}
                    onChange={(event) => updateSchoolYear(yearIndex, "name", event.target.value)}
                    required
                    className={cn(fieldControlClass, "bg-white")}
                    placeholder="2026-2027"
                  />
                </Field>
                <Field label="Start" required>
                  <input
                    type="date"
                    value={year.startsOn}
                    onChange={(event) => updateSchoolYear(yearIndex, "startsOn", event.target.value)}
                    required
                    className={cn(fieldControlClass, "bg-white")}
                  />
                </Field>
                <Field label="End" required>
                  <input
                    type="date"
                    value={year.endsOn}
                    onChange={(event) => updateSchoolYear(yearIndex, "endsOn", event.target.value)}
                    required
                    className={cn(fieldControlClass, "bg-white")}
                  />
                </Field>
                <Field label="Status" required>
                  {year.status === "active" ? (
                    <div className="flex min-h-12 items-center rounded-lg border border-[#2e7d32]/20 bg-[#e8f5e9] px-3 text-[12px] font-bold text-[#2e7d32]">
                      Active
                    </div>
                  ) : (
                    <select
                      value={year.status}
                      onChange={(event) => updateSchoolYearStatus(yearIndex, event.target.value === "closed" ? "closed" : "upcoming")}
                      className={cn(fieldControlClass, "bg-white")}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="closed">Closed</option>
                    </select>
                  )}
                </Field>
                <div className="flex flex-wrap gap-2 min-[860px]:justify-end">
                  {year.status !== "active" ? (
                    <AdminButton type="button" tone="outline" onClick={() => setActiveSchoolYear(yearIndex)}>
                      Set active
                    </AdminButton>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeSchoolYear(yearIndex)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20 disabled:pointer-events-none disabled:opacity-50"
                    disabled={schoolYears.length === 1}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between sm:px-[18px]">
          <div>
            <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">Grades and sections</h2>
            <p className="mt-1 text-[11px] leading-4 text-[#5a6070]">
              Editing {initialData.selectedSetupSchoolYearName ?? "the selected school year"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton type="button" tone="outline" onClick={applyGradeTemplate}>
              <Wand2 className="size-4" />
              Grade 1-10
            </AdminButton>
            <AdminButton type="button" tone="outline" onClick={addSectionAToAll}>
              <Wand2 className="size-4" />
              Section A
            </AdminButton>
          </div>
        </div>

        <div className="grid gap-3 p-[18px]">
          {initialData.schoolYears.filter((year) => year.id).length > 0 ? (
            <Field label="Edit sections for">
              <select
                value={String(selectedSetupSchoolYearId)}
                onChange={(event) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("setupYearId", event.target.value);
                  window.location.href = url.toString();
                }}
                className={cn(fieldControlClass, "max-w-md bg-white")}
              >
                {initialData.schoolYears.filter((year) => year.id).map((year) => (
                  <option key={year.id} value={String(year.id)}>
                    {year.name} ({year.status})
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {grades.map((grade, gradeIndex) => (
            <div key={grade.id} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3">
              <div className="grid gap-2 min-[620px]:grid-cols-[minmax(160px,220px)_1fr_auto] min-[620px]:items-start">
                <Field label={`Grade ${gradeIndex + 1}`} required>
                  <input
                    value={grade.name}
                    onChange={(event) => updateGrade(gradeIndex, event.target.value)}
                    className={cn(fieldControlClass, "bg-white")}
                    placeholder="Grade name"
                  />
                </Field>

                <div className="grid gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
                    Sections <span className="text-[#e64a19]">*</span>
                  </span>
                  {grade.sections.map((section, sectionIndex) => (
                    <div key={`${grade.id}-section-${sectionIndex}`} className="flex gap-2">
                      <input
                        value={section}
                        onChange={(event) => updateSection(gradeIndex, sectionIndex, event.target.value)}
                        className={cn(fieldControlClass, "min-w-0 flex-1 bg-white")}
                        placeholder="Section name"
                      />
                      <button
                        type="button"
                        onClick={() => removeSection(gradeIndex, sectionIndex)}
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20 disabled:pointer-events-none disabled:opacity-50"
                        disabled={grade.sections.length === 1}
                        aria-label="Remove section"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <AdminButton type="button" tone="ghost" className="justify-self-start px-2.5" onClick={() => addSection(gradeIndex)}>
                    <Plus className="size-4" />
                    Add section
                  </AdminButton>
                </div>

                <button
                  type="button"
                  onClick={() => removeGrade(gradeIndex)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20 disabled:pointer-events-none disabled:opacity-50"
                  disabled={grades.length === 1}
                >
                  <Trash2 className="size-4" />
                  Remove
                </button>
              </div>
            </div>
          ))}

          <AdminButton type="button" tone="outline" className="justify-self-start" onClick={addGrade}>
            <Plus className="size-4" />
            Add grade level
          </AdminButton>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
        <AdminButton type="submit" tone="primary">
          <Save className="size-4" />
          Save school setup
        </AdminButton>
      </div>
    </form>
  );
}
