"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ClipboardList, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function OtherFeesManagementModal({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#0f1117] bg-[#0f1117] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#2d3348] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
      >
        <Plus className="size-4" />
        Add fee type
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            aria-label="Close other fee setup"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="other-fees-modal-title"
            className="relative w-full max-w-5xl overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl"
          >
            <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-[18px]">
              <div className="min-w-0">
                <h2 id="other-fees-modal-title" className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-[#0f1117]">
                  <ClipboardList className="size-[17px] shrink-0 text-[#e64a19]" />
                  {title}
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-[#5a6070]">
                  Create other-fee types and assign them to enrolled students.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070]",
                  "transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
                )}
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-150px)] overflow-y-auto p-4 sm:p-[18px]">
              {children}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
