"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2, UserPlus, Users, X } from "lucide-react";

import { createStudentsBatchAction } from "@/app/admin/students/actions";
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

type StudentDraft = {
  key: string;
  studentReference: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthdate: string;
  sex: string;
  studentType: string;
  gradeLevelId: string;
  sectionId: string;
};

export function BulkStudentEnrollmentModal({
  ready,
  gradeOptions,
  sectionOptions,
}: {
  ready: boolean;
  gradeOptions: GradeOption[];
  sectionOptions: SectionOption[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<StudentDraft[]>([createDraft()]);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const payload = useMemo(
    () => rows.map((row) => ({
      studentReference: row.studentReference,
      firstName: row.firstName,
      middleName: row.middleName,
      lastName: row.lastName,
      birthdate: row.birthdate,
      sex: row.sex,
      studentType: row.studentType,
      gradeLevelId: row.gradeLevelId,
      sectionId: row.sectionId,
    })),
    [rows],
  );

  const updateRow = (key: string, field: keyof Omit<StudentDraft, "key">, value: string) => {
    setRows((current) => current.map((row) => (
      row.key === key
        ? { ...row, [field]: value }
        : row
    )));
  };

  const updateGrade = (key: string, value: string) => {
    setRows((current) => current.map((row) => (
      row.key === key ? { ...row, gradeLevelId: value, sectionId: "" } : row
    )));
  };

  const removeRow = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const addRow = () => {
    setRows((current) => [...current, createDraft()]);
  };

  const resetRows = () => {
    setRows([]);
  };

  return (
    <>
      <AdminButton
        type="button"
        tone="outline"
        disabled={!ready}
        onClick={() => setOpen(true)}
      >
        <Users className="size-4" />
        Add multiple students
      </AdminButton>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            aria-label="Close multiple student form"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[calc(100svh-48px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl"
          >
            <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-[18px]">
              <div className="min-w-0">
                <h2 id={titleId} className="flex items-center gap-2 text-[13px] font-bold leading-5 text-[#0f1117]">
                  <Users className="size-[17px] shrink-0 text-[#e64a19]" />
                  Add multiple students
                </h2>
                <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[#5a6070]">
                  Add each student with their own grade and section. Every valid row creates a student record and an active-year enrollment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={createStudentsBatchAction} className="flex min-h-0 flex-col">
              <input type="hidden" name="students" value={JSON.stringify(payload)} readOnly />
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                {rows.length > 0 ? (
                  rows.map((row, index) => {
                    const filteredSections = sectionOptions.filter((section) => section.gradeLevelId === Number(row.gradeLevelId));

                    return (
                      <div key={row.key} className="rounded-lg border border-black/[0.09] bg-[#f7f8fa] p-3 sm:p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[12.5px] font-bold text-[#0f1117]">
                            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#fde7e0] text-[11px] text-[#e64a19]">
                              {index + 1}
                            </span>
                            Student {index + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRow(row.key)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 text-[11.5px] font-semibold text-[#5a6070] transition hover:border-[#c62828]/25 hover:bg-[#ffebee] hover:text-[#c62828] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                            aria-label={`Remove student ${index + 1}`}
                          >
                            <Trash2 className="size-3.5" />
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <BatchField label="Student reference" required>
                            <input value={row.studentReference} onChange={(event) => updateRow(row.key, "studentReference", event.target.value)} className={fieldControlClass} placeholder="e.g. BWA-2025-0312" required />
                          </BatchField>
                          <BatchField label="First name" required>
                            <input value={row.firstName} onChange={(event) => updateRow(row.key, "firstName", event.target.value)} className={fieldControlClass} placeholder="Juan Miguel" required />
                          </BatchField>
                          <BatchField label="Middle name">
                            <input value={row.middleName} onChange={(event) => updateRow(row.key, "middleName", event.target.value)} className={fieldControlClass} placeholder="Optional" />
                          </BatchField>
                          <BatchField label="Last name" required>
                            <input value={row.lastName} onChange={(event) => updateRow(row.key, "lastName", event.target.value)} className={fieldControlClass} placeholder="Santos" required />
                          </BatchField>
                          <BatchField label="Birthdate">
                            <input value={row.birthdate} onChange={(event) => updateRow(row.key, "birthdate", event.target.value)} className={fieldControlClass} type="date" />
                          </BatchField>
                          <BatchField label="Sex" required>
                            <select value={row.sex} onChange={(event) => updateRow(row.key, "sex", event.target.value)} className={fieldControlClass} required><option value="">Choose sex</option><option value="male">Male</option><option value="female">Female</option></select>
                          </BatchField>
                          <BatchField label="Student type" required>
                            <select value={row.studentType} onChange={(event) => updateRow(row.key, "studentType", event.target.value)} className={fieldControlClass} required><option value="">Choose type</option><option value="new">New</option><option value="transferee">Transferee</option><option value="returned">Returned</option></select>
                          </BatchField>
                          <BatchField label="Grade level" required>
                            <select value={row.gradeLevelId} onChange={(event) => updateGrade(row.key, event.target.value)} className={fieldControlClass} required disabled={!ready}>
                              <option value="">Choose grade</option>
                              {gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                            </select>
                          </BatchField>
                          <BatchField label="Section" required>
                            <select value={row.sectionId} onChange={(event) => updateRow(row.key, "sectionId", event.target.value)} className={fieldControlClass} required disabled={!ready || !row.gradeLevelId || filteredSections.length === 0}>
                              <option value="">{!row.gradeLevelId ? "Choose grade first" : filteredSections.length > 0 ? "Choose section" : "No sections for this grade"}</option>
                              {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
                            </select>
                          </BatchField>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-[12.5px] text-[#5a6070]">
                    No student rows. Add a row to begin.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-black/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex flex-wrap gap-2">
                  <AdminButton type="button" tone="outline" onClick={addRow} disabled={!ready || rows.length >= 50}>
                    <Plus className="size-4" />
                    Add student
                  </AdminButton>
                  <AdminButton type="button" tone="ghost" onClick={resetRows} disabled={rows.length === 0}>
                    Clear all
                  </AdminButton>
                </div>
                <AdminButton type="submit" tone="primary" disabled={!ready || rows.length === 0}>
                  <UserPlus className="size-4" />
                  Save students
                </AdminButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function BatchField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Field label={label} required={required}>
      {children}
    </Field>
  );
}

function createDraft(): StudentDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    studentReference: "",
    firstName: "",
    middleName: "",
    lastName: "",
    birthdate: "",
    sex: "",
    studentType: "",
    gradeLevelId: "",
    sectionId: "",
  };
}
