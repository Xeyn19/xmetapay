"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Plus, Trash2, UserPlus, Users, X } from "lucide-react";

import { createStudentsBatchAction } from "@/app/admin/students/actions";
import { AdminButton, Field, fieldControlClass } from "../../_components/admin-ui";

type GradeOption = { id: number; name: string };
type SectionOption = { id: number; gradeLevelId: number; label: string };
type Defaults = { studentType: string; gradeLevelId: string; sectionId: string };
type StudentDraft = Defaults & {
  key: string;
  studentReference: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthdate: string;
  sex: string;
};

export function BulkStudentEnrollmentModal({
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
  const [defaults, setDefaults] = useState<Defaults>({ studentType: "new", gradeLevelId: "", sectionId: "" });
  const [rows, setRows] = useState<StudentDraft[]>([createDraft({ studentType: "new", gradeLevelId: "", sectionId: "" })]);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const reference = row.studentReference.trim().toLowerCase();
      if (reference) counts.set(reference, (counts.get(reference) ?? 0) + 1);
    });
    return new Set(rows.filter((row) => {
      const reference = row.studentReference.trim().toLowerCase();
      return reference && (counts.get(reference) ?? 0) > 1;
    }).map((row) => row.key));
  }, [rows]);
  const incompleteKeys = useMemo(() => new Set(rows.filter((row) => !rowComplete(row)).map((row) => row.key)), [rows]);
  const payload = useMemo(() => rows.map((row) => ({
    studentReference: row.studentReference,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    birthdate: row.birthdate,
    sex: row.sex,
    studentType: row.studentType,
    gradeLevelId: row.gradeLevelId,
    sectionId: row.sectionId,
  })), [rows]);
  const defaultSections = sectionOptions.filter((section) => section.gradeLevelId === Number(defaults.gradeLevelId));
  const defaultsReady = Boolean(defaults.studentType && defaults.gradeLevelId && defaults.sectionId);
  const canSubmit = ready && rows.length > 0 && incompleteKeys.size === 0 && duplicateKeys.size === 0;

  function updateRow(key: string, field: keyof Omit<StudentDraft, "key">, value: string) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
  }

  function updateGrade(key: string, gradeLevelId: string) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, gradeLevelId, sectionId: "" } : row));
  }

  function updateDefaultGrade(gradeLevelId: string) {
    setDefaults((current) => ({ ...current, gradeLevelId, sectionId: "" }));
  }

  function applyDefaults() {
    if (!defaultsReady) return;
    setRows((current) => current.map((row) => ({ ...row, ...defaults })));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
      <button type="button" aria-label="Close multiple student form" className="fixed inset-0 cursor-default" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[calc(100svh-48px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 text-[14px] font-bold text-[#0f1117]"><Users className="size-4 text-[#e64a19]" />Add multiple new students</h2>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[#5a6070]">Create up to 50 student records and active-year enrollments. Set shared class defaults, then adjust individual students when needed.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 text-[#5a6070] hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25" aria-label="Close modal"><X className="size-4" /></button>
        </div>

        <form action={createStudentsBatchAction} className="flex min-h-0 flex-col">
          <input type="hidden" name="students" value={JSON.stringify(payload)} readOnly />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <section className="rounded-lg border border-black/[0.09] bg-[#f7f8fa] p-3.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[#0f1117]">Shared enrollment defaults</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#5a6070]">New rows use these values. Apply them to all current rows, then override any student individually.</p>
                </div>
                <div className="grid flex-[2] gap-2 sm:grid-cols-3">
                  <select value={defaults.studentType} onChange={(event) => setDefaults((current) => ({ ...current, studentType: event.target.value }))} className={fieldControlClass} aria-label="Default student type"><option value="">Student type</option><option value="new">New</option><option value="transferee">Transferee</option><option value="returned">Returned</option></select>
                  <select value={defaults.gradeLevelId} onChange={(event) => updateDefaultGrade(event.target.value)} className={fieldControlClass} aria-label="Default grade"><option value="">Choose grade</option>{gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select>
                  <select value={defaults.sectionId} onChange={(event) => setDefaults((current) => ({ ...current, sectionId: event.target.value }))} className={fieldControlClass} disabled={!defaults.gradeLevelId} aria-label="Default section"><option value="">{defaults.gradeLevelId ? "Choose section" : "Choose grade first"}</option>{defaultSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select>
                </div>
                <AdminButton type="button" tone="outline" onClick={applyDefaults} disabled={!defaultsReady || rows.length === 0} className="shrink-0">Apply to all rows</AdminButton>
              </div>
            </section>

            {rows.length > 0 ? rows.map((row, index) => {
              const filteredSections = sectionOptions.filter((section) => section.gradeLevelId === Number(row.gradeLevelId));
              const duplicate = duplicateKeys.has(row.key);
              const incomplete = incompleteKeys.has(row.key);
              return (
                <section key={row.key} className={`rounded-lg border p-3 sm:p-4 ${duplicate ? "border-[#c62828]/30 bg-[#fff5f5]" : incomplete ? "border-[#f59e0b]/30 bg-[#fffbf2]" : "border-black/[0.09] bg-[#f7f8fa]"}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#fde7e0] text-[11px] font-bold text-[#e64a19]">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold text-[#0f1117]">Student {index + 1}</p>
                        <p className={`flex items-center gap-1 text-[10.5px] ${duplicate ? "text-[#c62828]" : incomplete ? "text-[#9a6700]" : "text-[#2e7d32]"}`}>{duplicate || incomplete ? <CircleAlert className="size-3" /> : <CheckCircle2 className="size-3" />}{duplicate ? "Duplicate reference in this batch" : incomplete ? "Complete the required fields" : "Ready to save"}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-[11.5px] font-semibold text-[#5a6070] hover:bg-[#ffebee] hover:text-[#c62828]" aria-label={`Remove student ${index + 1}`}><Trash2 className="size-3.5" />Remove</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <BatchField label="Student reference" required><input value={row.studentReference} onChange={(event) => updateRow(row.key, "studentReference", event.target.value)} className={fieldControlClass} placeholder="e.g. BWA-2025-0312" /></BatchField>
                    <BatchField label="First name" required><input value={row.firstName} onChange={(event) => updateRow(row.key, "firstName", event.target.value)} className={fieldControlClass} placeholder="Juan Miguel" /></BatchField>
                    <BatchField label="Middle name"><input value={row.middleName} onChange={(event) => updateRow(row.key, "middleName", event.target.value)} className={fieldControlClass} placeholder="Optional" /></BatchField>
                    <BatchField label="Last name" required><input value={row.lastName} onChange={(event) => updateRow(row.key, "lastName", event.target.value)} className={fieldControlClass} placeholder="Santos" /></BatchField>
                    <BatchField label="Birthdate"><input value={row.birthdate} onChange={(event) => updateRow(row.key, "birthdate", event.target.value)} className={fieldControlClass} type="date" /></BatchField>
                    <BatchField label="Sex" required><select value={row.sex} onChange={(event) => updateRow(row.key, "sex", event.target.value)} className={fieldControlClass}><option value="">Choose sex</option><option value="male">Male</option><option value="female">Female</option></select></BatchField>
                    <BatchField label="Student type" required><select value={row.studentType} onChange={(event) => updateRow(row.key, "studentType", event.target.value)} className={fieldControlClass}><option value="">Choose type</option><option value="new">New</option><option value="transferee">Transferee</option><option value="returned">Returned</option></select></BatchField>
                    <BatchField label="Grade level" required><select value={row.gradeLevelId} onChange={(event) => updateGrade(row.key, event.target.value)} className={fieldControlClass} disabled={!ready}><option value="">Choose grade</option>{gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></BatchField>
                    <BatchField label="Section" required><select value={row.sectionId} onChange={(event) => updateRow(row.key, "sectionId", event.target.value)} className={fieldControlClass} disabled={!ready || !row.gradeLevelId || filteredSections.length === 0}><option value="">{!row.gradeLevelId ? "Choose grade first" : filteredSections.length ? "Choose section" : "No sections for this grade"}</option>{filteredSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></BatchField>
                  </div>
                </section>
              );
            }) : <div className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-[12.5px] text-[#5a6070]">No student rows. Add a row to begin.</div>}
          </div>

          <div className="flex flex-col gap-3 border-t border-black/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap gap-2"><AdminButton type="button" tone="outline" onClick={() => setRows((current) => [...current, createDraft(defaults)])} disabled={!ready || rows.length >= 50}><Plus className="size-4" />Add student</AdminButton><AdminButton type="button" tone="ghost" onClick={() => setRows([])} disabled={!rows.length}>Clear all</AdminButton></div>
            <div className="flex flex-col gap-2 sm:items-end"><p className="text-[10.5px] text-[#5a6070]">{duplicateKeys.size ? `${duplicateKeys.size} duplicate reference${duplicateKeys.size === 1 ? "" : "s"}` : incompleteKeys.size ? `${incompleteKeys.size} incomplete row${incompleteKeys.size === 1 ? "" : "s"}` : `${rows.length} row${rows.length === 1 ? "" : "s"} ready`}</p><AdminButton type="submit" tone="primary" disabled={!canSubmit}><UserPlus className="size-4" />Save {rows.length || ""} student{rows.length === 1 ? "" : "s"}</AdminButton></div>
          </div>
        </form>
      </section>
    </div>
  );
}

function BatchField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <Field label={label} required={required}>{children}</Field>;
}

function createDraft(defaults: Defaults): StudentDraft {
  return { key: `${Date.now()}-${Math.random()}`, studentReference: "", firstName: "", middleName: "", lastName: "", birthdate: "", sex: "", ...defaults };
}

function rowComplete(row: StudentDraft) {
  return Boolean(row.studentReference.trim() && row.firstName.trim() && row.lastName.trim() && row.sex && row.studentType && row.gradeLevelId && row.sectionId);
}
