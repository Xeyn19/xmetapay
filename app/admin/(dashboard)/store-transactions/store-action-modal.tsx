"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Plus, Store, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function StoreActionModal({
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
  triggerIcon: "plus" | "store";
  triggerTone?: "dark" | "outline";
  size?: "small" | "wide";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const TriggerIcon = triggerIcon === "store" ? Store : Plus;

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
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25",
          triggerTone === "dark"
            ? "border-[#0f1117] bg-[#0f1117] text-white hover:bg-[#2d3348]"
            : "border-black/10 bg-white text-[#0f1117] hover:border-[#e64a19]/35 hover:bg-[#fff5f2]",
        )}
      >
        <TriggerIcon className="size-4" />
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            aria-label="Close store action"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "relative flex max-h-[calc(100svh-48px)] w-full flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl",
              size === "small" ? "max-w-xl" : "max-w-3xl",
            )}
          >
            <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-[18px]">
              <div className="min-w-0">
                <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-[#0f1117]">
                  <Store className="size-[17px] shrink-0 text-[#e64a19]" />
                  {title}
                </h2>
                <p className="mt-1 text-[11.5px] leading-5 text-[#5a6070]">
                  {description}
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
            <div className="overflow-y-auto p-4 sm:p-5">
              {children}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
