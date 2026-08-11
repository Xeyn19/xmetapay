"use client";

import { useEffect, useRef } from "react";
import { Clipboard, X } from "lucide-react";
import { toast } from "sonner";

import type { PaymentReminderHistoryRow } from "@/lib/admin/real-data";
import { readableDisabledControlClass } from "@/lib/ui/control-styles";
import { cn } from "@/lib/utils";

const unavailableMessage = "No saved message is available for this legacy reminder.";

export function PaymentReminderMessageDialog({ row, onClose }: {
  row: PaymentReminderHistoryRow | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!row) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, row]);

  if (!row) return null;
  const hasStoredMessage = row.message.trim().length > 0;
  const copyMessage = async () => {
    if (!hasStoredMessage) return;
    try {
      await navigator.clipboard.writeText(row.message);
      toast.success("Message copied", { description: "The stored reminder message is ready to paste." });
    } catch {
      toast.error("Message could not be copied", { description: "Select the message text and copy it manually." });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[230] grid place-items-center overflow-y-auto bg-[#0f1117]/55 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-message-title"
        aria-describedby="reminder-message-description"
        className="relative my-auto flex max-h-[calc(100svh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-black/[0.09] bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/[0.07] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#e64a19]">Payment reminder</p>
            <h2 id="reminder-message-title" className="mt-1 text-[17px] font-bold text-[#0f1117]">Message details</h2>
            <p id="reminder-message-description" className="mt-1 text-[12px] leading-5 text-[#5a6070]">Read-only delivery content and audit context.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/15 bg-white text-[#5a6070] transition hover:border-[#e64a19]/40 hover:bg-[#fff5f2] hover:text-[#e64a19] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
            aria-label="Close message details"
          ><X className="size-5" /></button>
        </header>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <dl className="grid gap-3 rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-4 sm:grid-cols-2">
            <AuditItem label="Student" value={row.student} />
            <AuditItem label="Parent" value={row.parent} />
            <AuditItem label="Grade" value={row.grade} />
            <AuditItem label="Channel" value={row.channel} />
            <AuditItem label="Delivery status" value={row.status} />
            <AuditItem label="Created" value={row.created} />
            <AuditItem label="Template" value={row.templateName ?? "Default or legacy template"} />
            {row.archivedAt ? <AuditItem label="Archived" value={row.archivedAt} /> : null}
          </dl>
          <div className="mt-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#5a6070]">Email subject</p>
            <p className="mt-1 break-words text-[13px] font-semibold leading-5 text-[#0f1117] [overflow-wrap:anywhere]">{row.subjectLine?.trim() || "No subject was recorded for this reminder."}</p>
          </div>
          <div className="mt-4 rounded-lg border border-black/[0.09] bg-[#f7f8fa] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#5a6070]">Stored message</p>
              <button
                type="button"
                onClick={copyMessage}
                disabled={!hasStoredMessage}
                className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-[12px] font-semibold text-[#0f1117] transition hover:border-[#e64a19]/40 hover:bg-[#fff5f2] hover:text-[#e64a19] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25", readableDisabledControlClass)}
              ><Clipboard className="size-4" /> Copy message</button>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#0f1117] [overflow-wrap:anywhere]">{hasStoredMessage ? row.message : unavailableMessage}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuditItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a8295]">{label}</dt><dd className="mt-1 break-words text-[12.5px] font-semibold text-[#0f1117] [overflow-wrap:anywhere]">{value}</dd></div>;
}
