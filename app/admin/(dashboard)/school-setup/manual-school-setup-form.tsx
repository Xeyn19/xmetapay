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

export function ManualSchoolSetupForm({ initialData }: { initialData: AdminSchoolSetupFormData }) {
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
      <input type="hidden" name="gradeSetup" value={gradeSetup} />

      <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <div className="border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
          <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">School identity</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#5a6070]">
            Confirm the real school record that will scope students, fees, payments, and reports.
          </p>
        </div>
        <div className="grid gap-3 p-[18px] md:grid-cols-[1fr_220px]">
          <Field label="School name" required>
            <input
              name="schoolName"
              defaultValue={initialData.schoolName}
              required
              className={fieldControlClass}
              placeholder="Enter school name"
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
        <div className="border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
          <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">Active school year</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#5a6070]">
            This is the year used for enrollment, tuition, payments, and class sections.
          </p>
        </div>
        <div className="grid gap-3 p-[18px] md:grid-cols-3">
          <Field label="School year name" required>
            <input
              name="schoolYearName"
              defaultValue={initialData.schoolYearName}
              required
              className={fieldControlClass}
              placeholder="2026-2027"
            />
          </Field>
          <Field label="Start date" required>
            <input
              name="startsOn"
              type="date"
              defaultValue={initialData.startsOn}
              required
              className={fieldControlClass}
            />
          </Field>
          <Field label="End date" required>
            <input
              name="endsOn"
              type="date"
              defaultValue={initialData.endsOn}
              required
              className={fieldControlClass}
            />
          </Field>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between sm:px-[18px]">
          <div>
            <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">Grade levels and sections</h2>
            <p className="mt-1 text-[12px] leading-5 text-[#5a6070]">
              Add the real grade levels and sections used by this school year.
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
          {grades.map((grade, gradeIndex) => (
            <div key={grade.id} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3">
              <div className="grid gap-2 min-[620px]:grid-cols-[minmax(160px,220px)_1fr_auto] min-[620px]:items-start">
                <Field label={`Grade ${gradeIndex + 1}`} required>
                  <input
                    value={grade.name}
                    onChange={(event) => updateGrade(gradeIndex, event.target.value)}
                    className={cn(fieldControlClass, "bg-white")}
                    placeholder="Grade level name"
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
