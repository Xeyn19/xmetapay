"use client";

import { useMemo, useState } from "react";
import { Plus, Save, X } from "lucide-react";

import { saveSchoolYearStructureAction } from "@/app/admin/school-setup/actions";
import { AdminButton } from "@/app/admin/_components/admin-ui";
import type { AdminSchoolYearStructure } from "@/lib/school/setup";

type DraftSection = { id: number | null; key: string; name: string };
type DraftGrade = { id: number | null; key: string; name: string; sections: DraftSection[] };

export function SchoolYearStructureForm({ data }: { data: AdminSchoolYearStructure }) {
  const [grades, setGrades] = useState<DraftGrade[]>(() => data.grades.map((grade, gradeIndex) => ({
    id: grade.id,
    key: `grade-${gradeIndex}`,
    name: grade.name,
    sections: grade.sections.map((section, sectionIndex) => ({
      id: section.id,
      key: `section-${gradeIndex}-${sectionIndex}`,
      name: section.name,
    })),
  })));
  const payload = useMemo(() => grades.map((grade) => ({
    id: grade.id,
    name: grade.name.trim(),
    sections: grade.sections.map((section) => ({ id: section.id, name: section.name.trim() })).filter((section) => Boolean(section.name)),
  })), [grades]);
  const invalid = payload.length === 0 || payload.some((grade) => !grade.name || grade.sections.length === 0);

  function addGrade() {
    const key = `grade-new-${Date.now()}`;
    setGrades((current) => [...current, {
      id: null,
      key,
      name: "",
      sections: [{ id: null, key: `${key}-section`, name: "" }],
    }]);
  }

  function updateGrade(gradeKey: string, name: string) {
    setGrades((current) => current.map((grade) => grade.key === gradeKey ? { ...grade, name } : grade));
  }

  function removeNewGrade(gradeKey: string) {
    setGrades((current) => current.filter((grade) => grade.key !== gradeKey));
  }

  function addSection(gradeKey: string) {
    const key = `${gradeKey}-section-${Date.now()}`;
    setGrades((current) => current.map((grade) => grade.key === gradeKey
      ? { ...grade, sections: [...grade.sections, { id: null, key, name: "" }] }
      : grade));
  }

  function updateSection(gradeKey: string, sectionKey: string, name: string) {
    setGrades((current) => current.map((grade) => grade.key === gradeKey
      ? { ...grade, sections: grade.sections.map((section) => section.key === sectionKey ? { ...section, name } : section) }
      : grade));
  }

  function removeNewSection(gradeKey: string, sectionKey: string) {
    setGrades((current) => current.map((grade) => grade.key === gradeKey
      ? { ...grade, sections: grade.sections.filter((section) => section.key !== sectionKey) }
      : grade));
  }

  return (
    <form action={saveSchoolYearStructureAction} className="grid gap-4">
      <input type="hidden" name="schoolYearId" value={data.schoolYear.id} />
      <input type="hidden" name="gradeSetup" value={JSON.stringify(payload)} readOnly />

      <div className="rounded-lg border border-[#1565c0]/15 bg-[#e3f2fd] px-3.5 py-3 text-[12px] leading-5 text-[#1565c0]">
        Add or rename the grades and sections used in {data.schoolYear.name}. Existing records are updated in place so enrollments keep their links.
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {grades.map((grade, gradeIndex) => (
          <section key={grade.key} className="rounded-lg border border-black/[0.08] bg-[#f7f8fa] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#697084]">
                  <span>Grade level {gradeIndex + 1}</span>
                  <input
                    value={grade.name}
                    onChange={(event) => updateGrade(grade.key, event.target.value)}
                    required
                    placeholder="Grade 1"
                    className={`${fieldClass} bg-white`}
                  />
                </label>
              </div>
              {!grade.id ? (
                <button type="button" onClick={() => removeNewGrade(grade.key)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] hover:text-[#c62828]" aria-label={`Remove grade ${gradeIndex + 1}`} title="Remove grade">
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#697084]">Sections</div>
              {grade.sections.map((section, sectionIndex) => (
                <div key={section.key} className="flex items-center gap-2">
                  <input
                    value={section.name}
                    onChange={(event) => updateSection(grade.key, section.key, event.target.value)}
                    required
                    placeholder="Section A"
                    aria-label={`${grade.name || `Grade ${gradeIndex + 1}`} section ${sectionIndex + 1}`}
                    className={`${fieldClass} bg-white`}
                  />
                  {!section.id ? (
                    <button type="button" onClick={() => removeNewSection(grade.key, section.key)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] hover:text-[#c62828]" aria-label="Remove new section" title="Remove section">
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              <button type="button" onClick={() => addSection(grade.key)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-[#e64a19]/40 bg-white px-3 text-[12px] font-semibold text-[#e64a19] hover:bg-[#fff3ee] sm:justify-start">
                <Plus className="size-4" /> Add section
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-black/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <AdminButton type="button" tone="outline" onClick={addGrade} className="sm:w-auto">
          <Plus className="size-4" /> Add grade level
        </AdminButton>
        <AdminButton type="submit" tone="primary" disabled={invalid} className="sm:w-auto">
          <Save className="size-4" /> Save structure
        </AdminButton>
      </div>
    </form>
  );
}

const fieldClass = "min-h-11 w-full rounded-lg border border-black/15 px-3 text-[13px] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/15";
