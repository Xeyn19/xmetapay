"use client";

import { useEffect, useId, useState } from "react";
import { CalendarPlus, Pencil, School, X } from "lucide-react";

import {
  createSchoolYearAction,
  updateSchoolDetailsAction,
  updateSchoolYearAction,
} from "@/app/admin/school-setup/actions";
import { AdminButton } from "@/app/admin/_components/admin-ui";
import type { AdminSchoolSetupOverview } from "@/lib/school/setup";

type SchoolYear = Pick<AdminSchoolSetupOverview["schoolYears"][number], "id" | "name" | "startsOn" | "endsOn" | "status">;

export function EditSchoolDetailsModal({ schoolName, schoolCode }: { schoolName: string; schoolCode: string }) {
  return (
    <SetupModal
      title="Edit school details"
      description="Update the school identity shown across the admin portal."
      triggerLabel="Edit school details"
      triggerIcon="school"
    >
      <form action={updateSchoolDetailsAction} className="grid gap-4">
        <Field label="School name" required>
          <input name="schoolName" defaultValue={schoolName} required maxLength={180} className={fieldClass} />
        </Field>
        <Field label="School code" required hint="Use a short unique code, such as DFCAMS.">
          <input name="schoolCode" defaultValue={schoolCode} required maxLength={40} className={fieldClass} />
        </Field>
        <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] pt-4 min-[420px]:flex-row min-[420px]:justify-end">
          <ModalCloseButton />
          <AdminButton type="submit" tone="primary" className="min-[420px]:w-auto">Save details</AdminButton>
        </div>
      </form>
    </SetupModal>
  );
}

export function AddSchoolYearModal() {
  return (
    <SetupModal
      title="Add school year"
      description="Create the year first, then add its grades and sections."
      triggerLabel="Add school year"
      triggerIcon="calendar"
      triggerTone="primary"
    >
      <SchoolYearForm action={createSchoolYearAction} submitLabel="Add school year" />
    </SetupModal>
  );
}

export function EditSchoolYearModal({ year }: { year: SchoolYear }) {
  return (
    <SetupModal
      title={`Edit ${year.name}`}
      description="Update this year’s label and date range. Its lifecycle status stays unchanged."
      triggerLabel={`Edit ${year.name}`}
      triggerIcon="edit"
      iconOnly
    >
      <SchoolYearForm action={updateSchoolYearAction} submitLabel="Save year" year={year} />
    </SetupModal>
  );
}

function SchoolYearForm({
  action,
  submitLabel,
  year,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  year?: SchoolYear;
}) {
  return (
    <form action={action} className="grid gap-4">
      {year ? <input type="hidden" name="schoolYearId" value={year.id} /> : null}
      <Field label="School year" required hint="Example: 2027-2028">
        <input name="name" defaultValue={year?.name ?? ""} required maxLength={40} placeholder="2027-2028" className={fieldClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts on" required>
          <input type="date" name="startsOn" defaultValue={year?.startsOn ?? ""} required className={fieldClass} />
        </Field>
        <Field label="Ends on" required>
          <input type="date" name="endsOn" defaultValue={year?.endsOn ?? ""} required className={fieldClass} />
        </Field>
      </div>
      {!year ? (
        <div className="rounded-lg border border-[#1565c0]/15 bg-[#e3f2fd] px-3 py-2.5 text-[12px] leading-5 text-[#1565c0]">
          New years start as Upcoming. Use Activate only when the structure is ready.
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] pt-4 min-[420px]:flex-row min-[420px]:justify-end">
        <ModalCloseButton />
        <AdminButton type="submit" tone="primary" className="min-[420px]:w-auto">{submitLabel}</AdminButton>
      </div>
    </form>
  );
}

function SetupModal({
  title,
  description,
  triggerLabel,
  triggerIcon,
  triggerTone = "outline",
  iconOnly = false,
  children,
}: {
  title: string;
  description: string;
  triggerLabel: string;
  triggerIcon: "school" | "calendar" | "edit";
  triggerTone?: "primary" | "outline";
  iconOnly?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const Icon = triggerIcon === "calendar" ? CalendarPlus : triggerIcon === "edit" ? Pencil : School;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <AdminButton
        type="button"
        tone={triggerTone}
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        title={triggerLabel}
        className={iconOnly ? "size-11 w-11 shrink-0 px-0" : "w-full sm:w-auto"}
      >
        <Icon className="size-4" />
        {iconOnly ? <span className="sr-only">{triggerLabel}</span> : triggerLabel}
      </AdminButton>

      {open ? (
        <div className="fixed inset-0 z-[160] grid place-items-center overflow-y-auto bg-[#0f1117]/50 px-3 py-5 sm:px-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-xl overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[15px] font-bold text-[#0f1117]">{title}</h2>
                <p className="mt-1 text-[12px] leading-5 text-[#5a6070]">{description}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 text-[#5a6070] hover:bg-[#f7f8fa] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25" aria-label="Close dialog">
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[calc(100svh-120px)] overflow-y-auto p-4 sm:p-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ModalCloseButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/10 bg-white px-4 text-[12px] font-semibold text-[#5a6070] hover:bg-[#f7f8fa]">Cancel</button>;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#697084]">
      <span>{label}{required ? <span className="text-[#e64a19]"> *</span> : null}</span>
      {children}
      {hint ? <span className="text-[11px] font-normal normal-case leading-4 text-[#7a8296]">{hint}</span> : null}
    </label>
  );
}

const fieldClass = "min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-[13px] text-[#0f1117] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/15";
