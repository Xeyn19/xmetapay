"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ClipboardList, Plus, Receipt, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function OtherFeeActionModal({
  title,
  description,
  triggerLabel,
  triggerIcon,
  triggerTone = "outline",
  size = "wide",
  children,
}: {
  title: string;
  description: string;
  triggerLabel: string;
  triggerIcon: "plus" | "receipt";
  triggerTone?: "primary" | "outline";
  size?: "small" | "wide";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const TriggerIcon = triggerIcon === "receipt" ? Receipt : Plus;

  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key === "Tab" && focusable?.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };

    const trigger = triggerRef.current;
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); trigger?.focus(); };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
          triggerTone === "primary"
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            : "border-border bg-background text-foreground hover:border-primary/35 hover:bg-muted",
        )}
      >
        <TriggerIcon className="size-4" />
        {triggerLabel}
      </button>

      {open ? (
        <div className="portal-dialog-backdrop fixed inset-0 z-[200] grid place-items-center overflow-y-auto px-3 py-6 sm:px-6">
          <button
            type="button"
            aria-label="Close other fee setup"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "relative flex max-h-[calc(100svh-48px)] w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl",
              size === "small" ? "max-w-xl" : "max-w-4xl",
            )}
          >
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-[18px]">
              <div className="min-w-0">
                <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-foreground">
                  <ClipboardList className="size-[17px] shrink-0 text-primary" />
                  {title}
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground",
                  "transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              {children}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
