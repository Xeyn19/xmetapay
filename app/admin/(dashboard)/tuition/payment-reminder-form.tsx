"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { MailCheck, Send, X } from "lucide-react";
import { toast } from "sonner";

import { sendPaymentReminderEmailsAction, type ReminderActionState } from "@/app/admin/reminders/actions";
import { cn } from "@/lib/utils";

import { AdminButton, Field, fieldControlClass } from "../../_components/admin-ui";

const initialReminderActionState: ReminderActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

export function PaymentReminderForm() {
  const [open, setOpen] = useState(false);
  const [sendTo, setSendTo] = useState("all_unpaid");
  const titleId = useId();
  const [, formAction, pending] = useActionState(async (previousState: ReminderActionState, formData: FormData) => {
    const nextState = await sendPaymentReminderEmailsAction(previousState, formData);

    if (nextState.status !== "idle") {
      const showToast =
        nextState.status === "error" ? toast.error : nextState.status === "info" ? toast.info : toast.success;

      showToast(nextState.title, {
        description: nextState.description,
      });
    }

    if (nextState.status === "success") {
      setOpen(false);
    }

    return nextState;
  }, initialReminderActionState);

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
      <AdminButton type="button" tone="primary" disabled={pending} onClick={() => setOpen(true)}>
        <Send className="size-4" />
        Email reminders
      </AdminButton>

      {open ? (
        <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#0f1117]/45 px-3 py-6 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            aria-label="Close payment reminder dialog"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[calc(100svh-48px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/[0.07] px-4 py-3.5 sm:px-[18px]">
              <h2 id={titleId} className="text-[15px] font-bold leading-6 text-[#0f1117]">
                Send payment reminder emails
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={formAction} className="overflow-y-auto">
              <div className="space-y-4 px-4 py-5 sm:px-[22px]">
                <div className="flex items-start gap-2 rounded-lg border border-[#b8d9c1] bg-[#f1faf3] px-3 py-2.5 text-[12.5px] leading-5 text-[#246b36]">
                  <MailCheck className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Emails are sent immediately to linked parent email addresses. SMS reminders are not available yet.
                  </span>
                </div>

                <Field label="Send to" required>
                  <select
                    name="sendTo"
                    value={sendTo}
                    onChange={(event) => setSendTo(event.target.value)}
                    className={fieldControlClass}
                    required
                  >
                    <option value="all_unpaid">All parents with unpaid fees</option>
                    <option value="overdue_tuition">Parents with overdue tuition only</option>
                    <option value="specific_student">Specific student</option>
                  </select>
                </Field>

                {sendTo === "specific_student" ? (
                  <Field label="Student reference" required>
                    <input
                      name="studentReference"
                      className={fieldControlClass}
                      placeholder="Enter student reference"
                      required
                    />
                  </Field>
                ) : null}

                <Field label="Reminder type" required>
                  <select name="reminderType" className={fieldControlClass} required defaultValue="tuition_due">
                    <option value="tuition_due">Tuition due reminder</option>
                    <option value="overdue_notice">Overdue notice</option>
                    <option value="final_notice">Final notice</option>
                  </select>
                </Field>

                <Field label="Custom message (optional)">
                  <textarea
                    name="customMessage"
                    rows={3}
                    maxLength={500}
                    className={cn(fieldControlClass, "min-h-[74px] resize-y py-3")}
                    placeholder="Leave blank to use the default message template..."
                  />
                </Field>
                <p className="text-[11.5px] leading-5 text-[#5a6070]">
                  Custom message text is saved in reminder history. Leave it blank to use the default reminder template.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] px-4 py-3.5 sm:flex-row sm:justify-end sm:px-[22px]">
                <AdminButton type="button" tone="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                  Cancel
                </AdminButton>
                <AdminButton type="submit" tone="primary" className="w-full sm:w-auto" disabled={pending}>
                  <Send className="size-4" />
                  {pending ? "Sending emails..." : "Send email reminders"}
                </AdminButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
