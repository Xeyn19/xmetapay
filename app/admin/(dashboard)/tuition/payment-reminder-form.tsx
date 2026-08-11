"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Eye, MailCheck, Send, X } from "lucide-react";
import { toast } from "sonner";

import { sendPaymentReminderEmailsAction, type ReminderActionState } from "@/app/admin/reminders/actions";
import { cn } from "@/lib/utils";
import {
  builtInPaymentReminderTemplates,
  renderEmailTemplateText,
  sampleEmailTemplateValues,
  type PaymentReminderType,
  type SchoolEmailTemplate,
} from "@/lib/email/template-contract";

import { AdminButton, Field, fieldControlClass } from "../../_components/admin-ui";

const initialReminderActionState: ReminderActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

export function PaymentReminderForm({
  templates = builtInPaymentReminderTemplates,
}: {
  templates?: SchoolEmailTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [sendTo, setSendTo] = useState("all_unpaid");
  const [reminderType, setReminderType] = useState<PaymentReminderType>("tuition_due");
  const [templateReference, setTemplateReference] = useState(
    () => defaultTemplateReference(templates, "tuition_due"),
  );
  const [customMessage, setCustomMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const titleId = useId();
  const matchingTemplates = templates.filter(
    (template) => template.reminderType === reminderType && template.status === "active",
  );
  const selectedTemplate = matchingTemplates.find((template) => template.reference === templateReference)
    ?? matchingTemplates.find((template) => template.isDefault)
    ?? matchingTemplates[0];
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
                  <select
                    name="reminderType"
                    className={fieldControlClass}
                    required
                    value={reminderType}
                    onChange={(event) => {
                      const nextType = event.target.value as PaymentReminderType;
                      setReminderType(nextType);
                      setTemplateReference(defaultTemplateReference(templates, nextType));
                      setShowPreview(false);
                    }}
                  >
                    <option value="tuition_due">Tuition due reminder</option>
                    <option value="overdue_notice">Overdue notice</option>
                    <option value="final_notice">Final notice</option>
                  </select>
                </Field>

                <Field label="Email template" required>
                  <select
                    name="templateReference"
                    className={fieldControlClass}
                    required
                    value={selectedTemplate?.reference ?? ""}
                    onChange={(event) => {
                      setTemplateReference(event.target.value);
                      setShowPreview(false);
                    }}
                  >
                    {matchingTemplates.map((template) => (
                      <option key={template.reference} value={template.reference}>
                        {template.name}{template.isDefault ? " (Default)" : ""}{template.source === "builtin" ? " · XMETA" : " · School"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="One-time message override (optional)">
                  <textarea
                    name="customMessage"
                    rows={3}
                    maxLength={500}
                    className={cn(fieldControlClass, "min-h-[74px] resize-y py-3")}
                    placeholder="Leave blank to use the selected template message..."
                    value={customMessage}
                    onChange={(event) => {
                      setCustomMessage(event.target.value);
                      setShowPreview(false);
                    }}
                  />
                </Field>
                <p className="text-[11.5px] leading-5 text-[#5a6070]">
                  A one-time override changes only this send. XMETA Pay still adds the protected fee statement and saves the rendered message, template name, and subject in reminder history.
                </p>

                <AdminButton
                  type="button"
                  tone="outline"
                  className="w-full"
                  disabled={!selectedTemplate}
                  onClick={() => setShowPreview((current) => !current)}
                >
                  <Eye className="size-4" /> {showPreview ? "Hide preview" : "Preview selected template"}
                </AdminButton>

                {showPreview && selectedTemplate ? (
                  <div className="overflow-hidden rounded-lg border border-black/[0.08] bg-[#f7f8fa]">
                    <div className="bg-[#0f1117] px-4 py-3 text-white">
                      <div className="text-[12.5px] font-bold">XMETA Pay email preview</div>
                      <div className="mt-1 text-[10.5px] text-[#c7cad1]">Sample data only</div>
                    </div>
                    <div className="bg-white p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#e64a19]">Subject</div>
                      <div className="mt-1 break-words text-[12.5px] font-bold leading-5 text-[#0f1117]">
                        {renderEmailTemplateText(selectedTemplate.subjectTemplate, sampleEmailTemplateValues)}
                      </div>
                      <div className="mt-3 whitespace-pre-wrap break-words text-[12px] leading-5 text-[#303443]">
                        {renderEmailTemplateText(customMessage || selectedTemplate.messageTemplate, sampleEmailTemplateValues)}
                      </div>
                      <div className="mt-3 rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3 text-[11px] leading-5 text-[#5a6070]">
                        The itemized fees, official deadlines, installment schedule, and parent portal action are added automatically.
                      </div>
                    </div>
                  </div>
                ) : null}
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

function defaultTemplateReference(templates: SchoolEmailTemplate[], reminderType: PaymentReminderType) {
  const matching = templates.filter(
    (template) => template.reminderType === reminderType && template.status === "active",
  );
  return matching.find((template) => template.isDefault)?.reference ?? matching[0]?.reference ?? `builtin:${reminderType}`;
}
