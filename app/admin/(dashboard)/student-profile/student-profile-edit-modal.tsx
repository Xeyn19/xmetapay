"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { Edit, Info, LockKeyhole, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  updateStudentProfileAction,
  type StudentProfileUpdateActionState,
} from "@/app/admin/students/actions";
import type { AdminStudentProfileRealData } from "@/lib/admin/real-data";
import { cn } from "@/lib/utils";

import { AdminButton, Field, fieldControlClass } from "../../_components/admin-ui";

type EditableStudent = NonNullable<AdminStudentProfileRealData["student"]>["editable"];

const initialActionState: StudentProfileUpdateActionState = {
  status: "idle",
  title: "",
  description: "",
  fieldErrors: {},
  submittedAt: 0,
};

export function StudentProfileEditModal({
  studentId,
  fullName,
  editable,
}: {
  studentId: number;
  fullName: string;
  editable: EditableStudent;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(editable));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const canEditPlacement = editable.selectedSchoolYearIsActive && Boolean(editable.enrollmentId);
  const filteredSections = useMemo(
    () => editable.sectionOptions.filter((section) => section.gradeLevelId === Number(draft.gradeLevelId)),
    [draft.gradeLevelId, editable.sectionOptions],
  );
  const [actionState, formAction, pending] = useActionState(
    async (previousState: StudentProfileUpdateActionState, formData: FormData) => {
      const nextState = await updateStudentProfileAction(previousState, formData);

      if (nextState.status === "success") {
        toast.success(nextState.title, { description: nextState.description });
        setOpen(false);
        router.refresh();
      } else if (nextState.status === "error") {
        toast.error(nextState.title, { description: nextState.description });
      }

      return nextState;
    },
    initialActionState,
  );

  useEffect(() => {
    if (!open) return;

    firstFieldRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        setOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  function openModal() {
    setDraft(createDraft(editable));
    setOpen(true);
  }

  function closeModal() {
    if (pending) return;
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function updateDraft(field: keyof StudentDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "gradeLevelId" ? { sectionId: "" } : {}),
    }));
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[12.5px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
      >
        <Edit className="size-4" />
        Edit details
      </button>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/60 px-3 py-5 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            aria-label="Close edit student dialog"
            className="fixed inset-0 cursor-default"
            onClick={closeModal}
            disabled={pending}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative flex max-h-[calc(100svh-40px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 id={titleId} className="flex items-center gap-2 text-[15px] font-bold">
                  <Edit className="size-4 shrink-0 text-primary" />
                  Edit student details
                </h2>
                <p id={descriptionId} className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                  Update {fullName}&apos;s school record. Statuses and guardian information remain read-only.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={pending}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={formAction} className="min-h-0 overflow-y-auto">
              <input type="hidden" name="studentId" value={studentId} />
              {canEditPlacement ? <input type="hidden" name="enrollmentId" value={editable.enrollmentId ?? ""} /> : null}

              <div className="space-y-5 p-4 sm:p-5">
                {actionState.status === "error" ? (
                  <div role="alert" className="rounded-lg border border-destructive/25 bg-[var(--status-danger-bg)] px-3 py-2.5 text-[12px] leading-5 text-[var(--status-danger-foreground)]">
                    {actionState.description}
                  </div>
                ) : null}

                <section aria-labelledby={`${titleId}-student`}>
                  <div className="mb-3">
                    <h3 id={`${titleId}-student`} className="text-[13px] font-bold">Student information</h3>
                    <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                      These school-wide details appear in admin and linked parent views.
                    </p>
                  </div>

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <ProfileField label="Student reference" error={actionState.fieldErrors.studentReference} className="sm:col-span-2">
                      <input
                        ref={firstFieldRef}
                        name="studentReference"
                        value={draft.studentReference}
                        maxLength={60}
                        onChange={(event) => updateDraft("studentReference", event.target.value)}
                        className={errorClass(actionState.fieldErrors.studentReference)}
                        aria-invalid={Boolean(actionState.fieldErrors.studentReference)}
                        required
                      />
                    </ProfileField>
                    <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-[var(--status-warning-foreground)]/20 bg-[var(--status-warning-bg)] px-3 py-2.5 text-[11.5px] leading-5 text-[var(--status-warning-foreground)]">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      Existing guardian links stay connected. Future parent linking must use the updated reference.
                    </div>
                    <ProfileField label="First name" error={actionState.fieldErrors.firstName}>
                      <input name="firstName" value={draft.firstName} maxLength={80} onChange={(event) => updateDraft("firstName", event.target.value)} className={errorClass(actionState.fieldErrors.firstName)} aria-invalid={Boolean(actionState.fieldErrors.firstName)} required />
                    </ProfileField>
                    <ProfileField label="Middle name" error={actionState.fieldErrors.middleName} required={false}>
                      <input name="middleName" value={draft.middleName} maxLength={80} onChange={(event) => updateDraft("middleName", event.target.value)} className={errorClass(actionState.fieldErrors.middleName)} aria-invalid={Boolean(actionState.fieldErrors.middleName)} />
                    </ProfileField>
                    <ProfileField label="Last name" error={actionState.fieldErrors.lastName}>
                      <input name="lastName" value={draft.lastName} maxLength={80} onChange={(event) => updateDraft("lastName", event.target.value)} className={errorClass(actionState.fieldErrors.lastName)} aria-invalid={Boolean(actionState.fieldErrors.lastName)} required />
                    </ProfileField>
                    <ProfileField label="Birthdate" error={actionState.fieldErrors.birthdate} required={false}>
                      <input name="birthdate" type="date" max={todayDateKey()} value={draft.birthdate} onChange={(event) => updateDraft("birthdate", event.target.value)} className={errorClass(actionState.fieldErrors.birthdate)} aria-invalid={Boolean(actionState.fieldErrors.birthdate)} />
                    </ProfileField>
                    <ProfileField label="Sex" error={actionState.fieldErrors.sex}>
                      <select name="sex" value={draft.sex} onChange={(event) => updateDraft("sex", event.target.value)} className={errorClass(actionState.fieldErrors.sex)} aria-invalid={Boolean(actionState.fieldErrors.sex)} required>
                        <option value="">Choose sex</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </ProfileField>
                    <ReadOnlyField label="Student status" value={labelForValue(editable.studentStatus)} />
                  </div>
                </section>

                <section aria-labelledby={`${titleId}-placement`} className="border-t border-border pt-5">
                  <div className="mb-3">
                    <h3 id={`${titleId}-placement`} className="text-[13px] font-bold">Active-year placement</h3>
                    <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                      {editable.selectedSchoolYearName} · enrollment status {labelForValue(editable.enrollmentStatus)}
                    </p>
                  </div>

                  {!editable.selectedSchoolYearIsActive ? (
                    <PlacementNotice>
                      <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      Historical placement is read-only. Switch to the active school year to edit grade, section, or student type.
                    </PlacementNotice>
                  ) : !editable.enrollmentId ? (
                    <PlacementNotice>
                      <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        No active-year enrollment exists. Use{" "}
                        <Link href="/admin/students?intake=choose" className="font-bold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                          Enroll existing students
                        </Link>{" "}
                        before editing placement.
                      </span>
                    </PlacementNotice>
                  ) : null}

                  <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
                    <ProfileField label="Grade level" error={actionState.fieldErrors.gradeLevelId} required={canEditPlacement}>
                      <select name={canEditPlacement ? "gradeLevelId" : undefined} value={draft.gradeLevelId} onChange={(event) => updateDraft("gradeLevelId", event.target.value)} className={errorClass(actionState.fieldErrors.gradeLevelId)} disabled={!canEditPlacement} aria-invalid={Boolean(actionState.fieldErrors.gradeLevelId)} required={canEditPlacement}>
                        <option value="">Choose grade</option>
                        {editable.gradeOptions.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                      </select>
                    </ProfileField>
                    <ProfileField label="Section" error={actionState.fieldErrors.sectionId} required={canEditPlacement}>
                      <select name={canEditPlacement ? "sectionId" : undefined} value={draft.sectionId} onChange={(event) => updateDraft("sectionId", event.target.value)} className={errorClass(actionState.fieldErrors.sectionId)} disabled={!canEditPlacement || !draft.gradeLevelId} aria-invalid={Boolean(actionState.fieldErrors.sectionId)} required={canEditPlacement}>
                        <option value="">{draft.gradeLevelId ? "Choose section" : "Choose grade first"}</option>
                        {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
                      </select>
                    </ProfileField>
                    <ProfileField label="Student type" error={actionState.fieldErrors.studentType} required={canEditPlacement}>
                      <select name={canEditPlacement ? "studentType" : undefined} value={draft.studentType} onChange={(event) => updateDraft("studentType", event.target.value)} className={errorClass(actionState.fieldErrors.studentType)} disabled={!canEditPlacement} aria-invalid={Boolean(actionState.fieldErrors.studentType)} required={canEditPlacement}>
                        <option value="">Choose student type</option>
                        <option value="new">New</option>
                        <option value="transferee">Transferee</option>
                        <option value="returned">Returned</option>
                      </select>
                    </ProfileField>
                    <ReadOnlyField label="Enrollment status" value={labelForValue(editable.enrollmentStatus)} />
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-card px-4 py-3.5 min-[420px]:flex-row min-[420px]:justify-end sm:px-5">
                <AdminButton type="button" tone="outline" className="w-full min-[420px]:w-auto" onClick={closeModal} disabled={pending}>
                  Cancel
                </AdminButton>
                <AdminButton type="submit" tone="primary" className="w-full min-[420px]:w-auto" disabled={pending}>
                  <Save className="size-4" />
                  {pending ? "Saving details..." : "Save changes"}
                </AdminButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ProfileField({
  label,
  error,
  className,
  required = true,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Field label={label} required={required}>
        {children}
      </Field>
      {error ? <p className="mt-1 text-[11px] leading-4 text-destructive">{error}</p> : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{label}</span>
      <div
        role="textbox"
        aria-label={label}
        aria-readonly="true"
        className="flex min-h-12 items-center rounded-lg border border-border bg-muted/60 px-3 text-[12.5px] font-semibold text-muted-foreground"
      >
        <LockKeyhole className="mr-2 size-3.5 shrink-0" aria-hidden="true" />
        {value}
      </div>
    </div>
  );
}

function PlacementNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-[11.5px] leading-5 text-muted-foreground">
      {children}
    </div>
  );
}

function createDraft(editable: EditableStudent): StudentDraft {
  return {
    studentReference: editable.studentReference,
    firstName: editable.firstName,
    middleName: editable.middleName,
    lastName: editable.lastName,
    birthdate: editable.birthdate,
    sex: editable.sex,
    gradeLevelId: editable.gradeLevelId ? String(editable.gradeLevelId) : "",
    sectionId: editable.sectionId ? String(editable.sectionId) : "",
    studentType: editable.studentType,
  };
}

function errorClass(error?: string) {
  return cn(fieldControlClass, error && "border-destructive focus:border-destructive focus:ring-destructive/15");
}

function labelForValue(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

type StudentDraft = {
  studentReference: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthdate: string;
  sex: string;
  gradeLevelId: string;
  sectionId: string;
  studentType: string;
};
