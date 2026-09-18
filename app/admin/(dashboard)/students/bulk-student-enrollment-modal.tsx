"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Plus, Trash2, UserPlus, Users, X } from "lucide-react";

import { createStudentsBatchAction } from "@/app/admin/students/actions";
import { cn } from "@/lib/utils";
import { AdminButton } from "../../_components/admin-ui";

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
    <div className="fixed inset-0 z-[210] grid place-items-center bg-[#050812]/75 backdrop-blur-sm sm:px-6 sm:py-6">
      <button type="button" aria-label="Close multiple student form" className="fixed inset-0 cursor-default" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex h-svh w-full max-w-6xl flex-col overflow-hidden bg-[#101522] text-[#f6f7fb] shadow-2xl sm:h-auto sm:max-h-[calc(100svh-48px)] sm:rounded-xl sm:border sm:border-[#30384c] sm:shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#293146] bg-[#121827] px-4 py-4 sm:px-5 sm:py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 text-[15px] font-bold text-white sm:text-base"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e64a19]/15 text-[#ff6b3d]"><Users className="size-4" /></span>Add multiple new students</h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#aeb7c9] sm:ml-10">Create up to 50 student records and active-year enrollments. Set shared class defaults, then adjust individual students when needed.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#343d53] bg-[#171d2d] text-[#b9c1d1] transition hover:border-[#4a556f] hover:bg-[#20283b] hover:text-white focus:outline-none focus-visible:ring-3 focus-visible:ring-[#ff6b3d]/35" aria-label="Close modal"><X className="size-4" /></button>
        </div>

        <form action={createStudentsBatchAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="students" value={JSON.stringify(payload)} readOnly />
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#0a0e18] p-3 sm:p-5">
            <section className="rounded-xl border border-[#2e384e] bg-[#141b2b] p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.16)] sm:p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                <div className="min-w-0 flex-1 xl:max-w-xs">
                  <p className="text-[13px] font-bold text-white">Shared enrollment defaults</p>
                  <p className="mt-1 text-[11.5px] leading-5 text-[#aeb7c9]">New rows use these values. Apply them to all current rows, then override any student individually.</p>
                </div>
                <div className="grid flex-[2] gap-3 sm:grid-cols-3">
                  <BatchField label="Student type"><select value={defaults.studentType} onChange={(event) => setDefaults((current) => ({ ...current, studentType: event.target.value }))} className={bulkFieldControlClass}><option value="">Choose type</option><option value="new">New</option><option value="transferee">Transferee</option><option value="returned">Returned</option></select></BatchField>
                  <BatchField label="Grade level"><select value={defaults.gradeLevelId} onChange={(event) => updateDefaultGrade(event.target.value)} className={bulkFieldControlClass}><option value="">Choose grade</option>{gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></BatchField>
                  <BatchField label="Section"><select value={defaults.sectionId} onChange={(event) => setDefaults((current) => ({ ...current, sectionId: event.target.value }))} className={bulkFieldControlClass} disabled={!defaults.gradeLevelId}><option value="">{defaults.gradeLevelId ? "Choose section" : "Choose grade first"}</option>{defaultSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></BatchField>
                </div>
                <AdminButton type="button" tone="dark" onClick={applyDefaults} disabled={!defaultsReady || rows.length === 0} className="min-h-12 w-full shrink-0 border-[#414c65] bg-[#242c40] text-[#eef1f7] hover:bg-[#303a51] xl:w-auto">Apply to all rows</AdminButton>
              </div>
            </section>

            {rows.length > 0 ? rows.map((row, index) => {
              const filteredSections = sectionOptions.filter((section) => section.gradeLevelId === Number(row.gradeLevelId));
              const duplicate = duplicateKeys.has(row.key);
              const incomplete = incompleteKeys.has(row.key);
              return (
                <section key={row.key} className={cn("rounded-xl border border-l-[3px] bg-[#141a28] p-3 shadow-[0_10px_28px_rgba(0,0,0,0.14)] [contain-intrinsic-size:380px] [content-visibility:auto] sm:p-4", duplicate ? "border-[#ef5350]/45 border-l-[#ef5350]" : incomplete ? "border-[#d99b2b]/40 border-l-[#f0ae38]" : "border-[#3b7255]/50 border-l-[#4caf77]")}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e64a19]/15 text-xs font-bold text-[#ff7043]">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-white">Student {index + 1}</p>
                        <p className={cn("mt-0.5 flex items-center gap-1 text-[11px]", duplicate ? "text-[#ff8a85]" : incomplete ? "text-[#f5bd59]" : "text-[#72d69a]")}>{duplicate || incomplete ? <CircleAlert className="size-3" /> : <CheckCircle2 className="size-3" />}{duplicate ? "Duplicate reference in this batch" : incomplete ? "Complete the required fields" : "Ready to save"}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#374158] bg-[#1b2233] px-3 text-[11.5px] font-semibold text-[#b8c0d0] transition hover:border-[#ef5350]/50 hover:bg-[#2b1b24] hover:text-[#ff9a96] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#ef5350]/30" aria-label={`Remove student ${index + 1}`}><Trash2 className="size-3.5" />Remove</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <BatchField label="Student reference" required><input value={row.studentReference} onChange={(event) => updateRow(row.key, "studentReference", event.target.value)} className={bulkFieldControlClass} placeholder="e.g. BWA-2025-0312" aria-invalid={duplicate || !row.studentReference.trim()} /></BatchField>
                    <BatchField label="First name" required><input value={row.firstName} onChange={(event) => updateRow(row.key, "firstName", event.target.value)} className={bulkFieldControlClass} placeholder="Juan Miguel" aria-invalid={!row.firstName.trim()} /></BatchField>
                    <BatchField label="Middle name"><input value={row.middleName} onChange={(event) => updateRow(row.key, "middleName", event.target.value)} className={bulkFieldControlClass} placeholder="Optional" /></BatchField>
                    <BatchField label="Last name" required><input value={row.lastName} onChange={(event) => updateRow(row.key, "lastName", event.target.value)} className={bulkFieldControlClass} placeholder="Santos" aria-invalid={!row.lastName.trim()} /></BatchField>
                    <BatchField label="Birthdate"><input value={row.birthdate} onChange={(event) => updateRow(row.key, "birthdate", event.target.value)} className={bulkFieldControlClass} type="date" /></BatchField>
                    <BatchField label="Sex" required><select value={row.sex} onChange={(event) => updateRow(row.key, "sex", event.target.value)} className={bulkFieldControlClass} aria-invalid={!row.sex}><option value="">Choose sex</option><option value="male">Male</option><option value="female">Female</option></select></BatchField>
                    <BatchField label="Student type" required><select value={row.studentType} onChange={(event) => updateRow(row.key, "studentType", event.target.value)} className={bulkFieldControlClass} aria-invalid={!row.studentType}><option value="">Choose type</option><option value="new">New</option><option value="transferee">Transferee</option><option value="returned">Returned</option></select></BatchField>
                    <BatchField label="Grade level" required><select value={row.gradeLevelId} onChange={(event) => updateGrade(row.key, event.target.value)} className={bulkFieldControlClass} disabled={!ready} aria-invalid={!row.gradeLevelId}><option value="">Choose grade</option>{gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></BatchField>
                    <BatchField label="Section" required><select value={row.sectionId} onChange={(event) => updateRow(row.key, "sectionId", event.target.value)} className={bulkFieldControlClass} disabled={!ready || !row.gradeLevelId || filteredSections.length === 0} aria-invalid={!row.sectionId}><option value="">{!row.gradeLevelId ? "Choose grade first" : filteredSections.length ? "Choose section" : "No sections for this grade"}</option>{filteredSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></BatchField>
                  </div>
                </section>
              );
            }) : <div className="rounded-xl border border-dashed border-[#3a445b] bg-[#121725] px-4 py-10 text-center text-[12.5px] text-[#aeb7c9]">No student rows. Add a row to begin.</div>}
          </div>

          <div className="flex flex-col gap-3 border-t border-[#293146] bg-[#121827] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
            <div className="grid grid-cols-2 gap-2 sm:flex"><AdminButton type="button" tone="dark" onClick={() => setRows((current) => [...current, createDraft(defaults)])} disabled={!ready || rows.length >= 50} className="border-[#414c65] bg-[#242c40] text-[#eef1f7] hover:bg-[#303a51]"><Plus className="size-4" />Add student</AdminButton><AdminButton type="button" tone="ghost" onClick={() => setRows([])} disabled={!rows.length} className="text-[#b8c0d0] hover:bg-[#20283b] hover:text-white">Clear all</AdminButton></div>
            <div className="flex flex-col gap-2 sm:items-end"><p className={cn("text-[11px]", duplicateKeys.size ? "text-[#ff8a85]" : incompleteKeys.size ? "text-[#f5bd59]" : "text-[#72d69a]")}>{duplicateKeys.size ? `${duplicateKeys.size} duplicate reference${duplicateKeys.size === 1 ? "" : "s"}` : incompleteKeys.size ? `${incompleteKeys.size} incomplete row${incompleteKeys.size === 1 ? "" : "s"}` : `${rows.length} row${rows.length === 1 ? "" : "s"} ready`}</p><AdminButton type="submit" tone="primary" disabled={!canSubmit} className="min-h-12 w-full px-5 sm:w-auto"><UserPlus className="size-4" />Save {rows.length || ""} student{rows.length === 1 ? "" : "s"}</AdminButton></div>
          </div>
        </form>
      </section>
    </div>
  );
}

function BatchField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.055em] text-[#aeb7c9]">
        {label} {required ? <span className="text-[#ff7043]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

const bulkFieldControlClass =
  "min-h-12 min-w-0 w-full rounded-lg border border-[#3a445b] bg-[#0f1420] px-3 text-[13px] text-[#f4f6fb] [color-scheme:dark] outline-none transition placeholder:text-[#747f96] disabled:cursor-not-allowed disabled:border-[#2b3345] disabled:bg-[#111622] disabled:text-[#6f788a] focus:border-[#ff7043] focus:ring-3 focus:ring-[#ff7043]/15 aria-invalid:border-[#d99b2b]/70";

function createDraft(defaults: Defaults): StudentDraft {
  return { key: `${Date.now()}-${Math.random()}`, studentReference: "", firstName: "", middleName: "", lastName: "", birthdate: "", sex: "", ...defaults };
}

function rowComplete(row: StudentDraft) {
  return Boolean(row.studentReference.trim() && row.firstName.trim() && row.lastName.trim() && row.sex && row.studentType && row.gradeLevelId && row.sectionId);
}
