"use client";

import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { createStudentAction } from "@/app/admin/students/actions";

import { AdminButton, Field, fieldControlClass } from "../../_components/admin-ui";

type GradeOption = {
  id: number;
  name: string;
};

type SectionOption = {
  id: number;
  gradeLevelId: number;
  label: string;
};

export function StudentEnrollmentForm({
  ready,
  gradeOptions,
  sectionOptions,
}: {
  ready: boolean;
  gradeOptions: GradeOption[];
  sectionOptions: SectionOption[];
}) {
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const selectedGradeLevelId = Number(gradeLevelId);
  const filteredSectionOptions = useMemo(
    () => sectionOptions.filter((section) => section.gradeLevelId === selectedGradeLevelId),
    [sectionOptions, selectedGradeLevelId],
  );
  const sectionDisabled = !ready || !gradeLevelId || filteredSectionOptions.length === 0;

  return (
    <form action={createStudentAction} className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Student reference" required>
        <input name="studentReference" className={fieldControlClass} placeholder="e.g. BWA-2025-0312" required />
      </Field>
      <Field label="First name" required>
        <input name="firstName" className={fieldControlClass} placeholder="Juan Miguel" required />
      </Field>
      <Field label="Middle name">
        <input name="middleName" className={fieldControlClass} placeholder="Optional" />
      </Field>
      <Field label="Last name" required>
        <input name="lastName" className={fieldControlClass} placeholder="Santos" required />
      </Field>
      <Field label="Birthdate">
        <input name="birthdate" className={fieldControlClass} type="date" />
      </Field>
      <Field label="Sex" required>
        <select name="sex" className={fieldControlClass} required defaultValue="">
          <option value="">Choose sex</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </Field>
      <Field label="Student type" required>
        <select name="studentType" className={fieldControlClass} required defaultValue="">
          <option value="">Choose type</option>
          <option value="new">New</option>
          <option value="transferee">Transferee</option>
          <option value="returned">Returned</option>
        </select>
      </Field>
      <Field label="Grade level" required>
        <select
          name="gradeLevelId"
          className={fieldControlClass}
          required
          disabled={!ready}
          value={gradeLevelId}
          onChange={(event) => {
            setGradeLevelId(event.target.value);
            setSectionId("");
          }}
        >
          <option value="">Choose grade</option>
          {gradeOptions.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Section" required>
        <select
          name="sectionId"
          className={fieldControlClass}
          required
          disabled={sectionDisabled}
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
        >
          <option value="">
            {!gradeLevelId
              ? "Choose grade first"
              : filteredSectionOptions.length > 0
                ? "Choose section"
                : "No sections for this grade"}
          </option>
          {filteredSectionOptions.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end">
        <AdminButton
          type="submit"
          tone="primary"
          className="w-full"
          disabled={!ready || (Boolean(gradeLevelId) && filteredSectionOptions.length === 0)}
        >
          <UserPlus className="size-4" />
          Enroll student
        </AdminButton>
      </div>
    </form>
  );
}
