"use client";

import { Archive, ChevronDown, History, Send } from "lucide-react";
import { useState } from "react";

import type { PaymentReminderHistoryRow } from "@/lib/admin/real-data";
import type { SchoolEmailTemplate } from "@/lib/email/template-contract";
import { cn } from "@/lib/utils";

import { PaymentReminderForm } from "./payment-reminder-form";
import { PaymentReminderHistoryTable } from "./payment-reminder-history-table";

export function PaymentReminderPanel({
  templates,
  activeRows,
  archivedRows,
}: {
  templates: SchoolEmailTemplate[];
  activeRows: PaymentReminderHistoryRow[];
  archivedRows: PaymentReminderHistoryRow[];
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyCount = activeRows.length + archivedRows.length;

  return (
    <section id="payment-reminders" className="mb-[18px] scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between sm:px-[18px]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Send className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">Payment reminders</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              Email linked parents about open or partial tuition balances. Every delivery result stays available for audit; SMS remains future scope.
            </p>
          </div>
        </div>
        <div className="shrink-0"><PaymentReminderForm templates={templates} /></div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4 sm:px-[18px] lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 min-[420px]:grid-cols-2">
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-xs text-muted-foreground">
            <History className="size-4 text-primary" />
            <span><strong className="text-foreground">{activeRows.length}</strong> active history {activeRows.length === 1 ? "record" : "records"}</span>
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-xs text-muted-foreground">
            <Archive className="size-4 text-primary" />
            <span><strong className="text-foreground">{archivedRows.length}</strong> archived {archivedRows.length === 1 ? "record" : "records"}</span>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={historyOpen}
          aria-controls="payment-reminder-history"
          onClick={() => setHistoryOpen((current) => !current)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 lg:w-auto"
        >
          {historyOpen ? "Hide reminder history" : `Show reminder history (${historyCount})`}
          <ChevronDown className={cn("size-4 transition-transform", historyOpen && "rotate-180")} />
        </button>
      </div>

      {historyOpen ? (
        <div id="payment-reminder-history" className="border-t border-border">
          <PaymentReminderHistoryTable activeRows={activeRows} archivedRows={archivedRows} />
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        Reminder history is {historyOpen ? "shown" : "hidden"}.
      </p>
    </section>
  );
}
