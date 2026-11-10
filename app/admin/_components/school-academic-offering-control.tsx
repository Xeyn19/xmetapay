"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, Building2, GraduationCap, School, X } from "lucide-react";
import { useFormStatus } from "react-dom";

import { updateSchoolEducationScopeAction } from "@/app/admin/school-setup/actions";
import { AdminButton } from "@/app/admin/_components/admin-ui";
import type { EducationScope } from "@/lib/school/academic-offerings";
import { cn } from "@/lib/utils";

const offeringOptions: Array<{
  value: EducationScope;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof School;
}> = [
  {
    value: "basic",
    label: "Basic Education only (K–12)",
    shortLabel: "Basic Education (K–12)",
    description: "Kindergarten, Elementary, Junior High School, and/or Senior High School.",
    icon: BookOpen,
  },
  {
    value: "higher",
    label: "Higher Education only (College)",
    shortLabel: "Higher Education (College)",
    description: "College programs organized by academic period and year level.",
    icon: GraduationCap,
  },
  {
    value: "both",
    label: "Both K–12 and College",
    shortLabel: "Basic and Higher Education",
    description: "One institution offering both Basic Education and College.",
    icon: Building2,
  },
];

export function SchoolAcademicOfferingControl({
  currentScope,
  canManage,
}: {
  currentScope: EducationScope;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState<EducationScope>(currentScope);
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const current = offeringOptions.find((option) => option.value === currentScope) ?? offeringOptions[0];

  function openDialog() {
    setSelectedScope(currentScope);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => trigger?.focus());
    };
  }, [open]);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-button-soft text-primary">
            <current.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Current school type</div>
            <div className="mt-1 text-[15px] font-bold text-foreground">{current.shortLabel}</div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              This controls which academic setup and tuition options are available. Existing records are never deleted.
            </p>
          </div>
        </div>

        {canManage ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={openDialog}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3.5 text-[12.5px] font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
          >
            Change school type
          </button>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground sm:max-w-52 sm:text-right">
            Only the school administrator can change this setting.
          </p>
        )}
      </div>

      {open ? (
        <div className="portal-dialog-backdrop fixed inset-0 z-[200] grid place-items-center overflow-y-auto px-3 py-6 sm:px-6">
          <button type="button" aria-label="Close school type dialog" className="fixed inset-0 cursor-default" onClick={() => setOpen(false)} />
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative flex max-h-[calc(100svh-48px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[15px] font-bold text-foreground">Change school type</h2>
                <p id={descriptionId} className="mt-1 text-xs leading-5 text-muted-foreground">
                  Choose the academic levels this school currently offers. This changes available setup tools; it does not delete records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Close school type dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={updateSchoolEducationScopeAction} className="flex min-h-0 flex-1 flex-col">
              <div className="grid gap-3 overflow-y-auto p-4 sm:p-5">
                {offeringOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = selectedScope === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                        "focus-within:ring-3 focus-within:ring-ring/50",
                        selected ? "border-primary bg-primary/8" : "border-border bg-background hover:border-primary/35 hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="educationScope"
                        value={option.value}
                        checked={selected}
                        onChange={() => setSelectedScope(option.value)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        <Icon className="size-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-foreground">{option.label}</span>
                        <span className="mt-1 block text-[11.5px] leading-5 text-muted-foreground">{option.description}</span>
                      </span>
                    </label>
                  );
                })}

                {selectedScope !== currentScope ? (
                  <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg px-3 py-2.5 text-xs leading-5 text-status-info-foreground" role="status">
                    Existing academic and financial records stay protected. A change that would hide a track with dependent records will be safely rejected.
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-4 min-[420px]:flex-row min-[420px]:justify-end sm:px-5">
                <AdminButton type="button" tone="ghost" onClick={() => setOpen(false)} className="min-[420px]:w-auto">Cancel</AdminButton>
                <SaveSchoolTypeButton unchanged={selectedScope === currentScope} />
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function SaveSchoolTypeButton({ unchanged }: { unchanged: boolean }) {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" tone="primary" disabled={unchanged || pending} className="min-[420px]:w-auto">
      {pending ? "Saving…" : "Save school type"}
    </AdminButton>
  );
}
