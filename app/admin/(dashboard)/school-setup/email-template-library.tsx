"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Copy, Eye, Mail, Pencil, Plus, Power, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveSchoolEmailTemplateAction,
  toggleSchoolEmailTemplateAction,
  type SchoolEmailTemplateActionState,
} from "@/app/admin/email-templates/actions";
import { AdminButton, Field, StatusPill, fieldControlClass } from "@/app/admin/_components/admin-ui";
import {
  emailTemplateVariableKeys,
  labelForPaymentReminderType,
  renderEmailTemplateText,
  sampleEmailTemplateValues,
  type PaymentReminderType,
  type SchoolEmailTemplate,
} from "@/lib/email/template-contract";
import type { SchoolEmailTemplateLibrary as TemplateLibraryData } from "@/lib/email/templates";
import { cn } from "@/lib/utils";

const idleState: SchoolEmailTemplateActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

type TemplateDraft = {
  id: number | null;
  reminderType: PaymentReminderType;
  name: string;
  subjectTemplate: string;
  messageTemplate: string;
  status: "active" | "inactive";
  isDefault: boolean;
};

const emptyDraft: TemplateDraft = {
  id: null,
  reminderType: "tuition_due",
  name: "",
  subjectTemplate: "{{school_name}}: Payment reminder for {{student_name}}",
  messageTemplate: "Hello {{parent_name}}, this is a reminder about the outstanding school balance for {{student_name}}.",
  status: "active",
  isDefault: false,
};

export function EmailTemplateLibrary({ library }: { library: TemplateLibraryData }) {
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [previewing, setPreviewing] = useState<SchoolEmailTemplate | null>(null);
  const builtIns = library.templates.filter((template) => template.source === "builtin");
  const schoolTemplates = library.templates.filter((template) => template.source === "school");

  function editTemplate(template: SchoolEmailTemplate) {
    setDraft(templateToDraft(template, false));
  }

  function duplicateTemplate(template: SchoolEmailTemplate) {
    setDraft(templateToDraft(template, true));
  }

  return (
    <div className="space-y-4">
      {library.warning ? (
        <div className="rounded-lg border border-status-warning-foreground/25 bg-status-warning-bg px-3.5 py-3 text-[12.5px] leading-5 text-status-warning-foreground">
          {library.warning}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl text-[12.5px] leading-5 text-[#5a6070]">
          SMTP credentials remain protected in the environment. Templates control only the subject and introductory message; XMETA Pay always adds the authoritative fee statement and parent portal link.
        </div>
        <AdminButton
          tone="primary"
          className="w-full shrink-0 sm:w-auto"
          disabled={Boolean(library.warning)}
          onClick={() => setDraft({ ...emptyDraft })}
        >
          <Plus className="size-4" /> Create template
        </AdminButton>
      </div>

      <TemplateGroup
        title="Protected XMETA templates"
        detail="Always available and safe to copy into a school-specific version."
        templates={builtIns}
        onEdit={editTemplate}
        onDuplicate={duplicateTemplate}
        onPreview={setPreviewing}
      />

      <TemplateGroup
        title="School templates"
        detail="Only active templates appear in the payment-reminder sender."
        templates={schoolTemplates}
        empty="No school-specific templates yet. Copy a protected template or create one."
        onEdit={editTemplate}
        onDuplicate={duplicateTemplate}
        onPreview={setPreviewing}
      />

      {draft ? <TemplateEditor draft={draft} onChange={setDraft} onClose={() => setDraft(null)} /> : null}
      {previewing ? <TemplatePreview template={previewing} onClose={() => setPreviewing(null)} /> : null}
    </div>
  );
}

function TemplateGroup({
  title,
  detail,
  templates,
  empty,
  onEdit,
  onDuplicate,
  onPreview,
}: {
  title: string;
  detail: string;
  templates: SchoolEmailTemplate[];
  empty?: string;
  onEdit: (template: SchoolEmailTemplate) => void;
  onDuplicate: (template: SchoolEmailTemplate) => void;
  onPreview: (template: SchoolEmailTemplate) => void;
}) {
  return (
    <section>
      <div className="mb-2.5">
        <h3 className="text-[13px] font-bold text-[#0f1117]">{title}</h3>
        <p className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">{detail}</p>
      </div>
      {templates.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <article key={template.reference} className="flex min-w-0 flex-col rounded-lg border border-black/[0.08] bg-[#f7f8fa] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-[#0f1117]">{template.name}</div>
                  <div className="mt-1 text-[11px] text-[#5a6070]">{labelForPaymentReminderType(template.reminderType)}</div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {template.isDefault ? <StatusPill tone="active">Default</StatusPill> : null}
                  <StatusPill tone={template.status === "active" ? "active" : "inactive"}>
                    {template.status === "active" ? "Active" : "Inactive"}
                  </StatusPill>
                </div>
              </div>
              <div className="mt-3 line-clamp-2 min-h-10 text-[11.5px] leading-5 text-[#5a6070]">
                {template.subjectTemplate}
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <AdminButton tone="outline" className="px-2" onClick={() => onPreview(template)}>
                  <Eye className="size-4" /> Preview
                </AdminButton>
                {template.editable ? (
                  <AdminButton tone="outline" className="px-2" onClick={() => onEdit(template)}>
                    <Pencil className="size-4" /> Edit
                  </AdminButton>
                ) : (
                  <AdminButton tone="outline" className="px-2" onClick={() => onDuplicate(template)}>
                    <Copy className="size-4" /> Copy
                  </AdminButton>
                )}
              </div>
              {template.editable && template.id ? <TemplateStatusButton template={template} /> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-black/15 bg-[#f7f8fa] px-4 py-7 text-center text-[12.5px] text-[#5a6070]">
          {empty}
        </div>
      )}
    </section>
  );
}

function TemplateStatusButton({ template }: { template: SchoolEmailTemplate }) {
  const router = useRouter();
  const [, action, pending] = useActionState(async (previous: SchoolEmailTemplateActionState, formData: FormData) => {
    const next = await toggleSchoolEmailTemplateAction(previous, formData);
    if (next.status === "error") toast.error(next.title, { description: next.description });
    if (next.status === "success") {
      toast.success(next.title, { description: next.description });
      router.refresh();
    }
    return next;
  }, idleState);

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="templateId" value={template.id ?? ""} />
      <input type="hidden" name="nextStatus" value={template.status === "active" ? "inactive" : "active"} />
      <AdminButton type="submit" tone="ghost" className="w-full" disabled={pending}>
        <Power className="size-4" />
        {pending ? "Updating..." : template.status === "active" ? "Deactivate" : "Activate"}
      </AdminButton>
    </form>
  );
}

function TemplateEditor({
  draft,
  onChange,
  onClose,
}: {
  draft: TemplateDraft;
  onChange: (draft: TemplateDraft) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const [, action, pending] = useActionState(async (previous: SchoolEmailTemplateActionState, formData: FormData) => {
    const next = await saveSchoolEmailTemplateAction(previous, formData);
    if (next.status === "error") toast.error(next.title, { description: next.description });
    if (next.status === "success") {
      toast.success(next.title, { description: next.description });
      onClose();
      router.refresh();
    }
    return next;
  }, idleState);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, pending]);

  const previewSubject = renderEmailTemplateText(draft.subjectTemplate, sampleEmailTemplateValues);
  const previewMessage = renderEmailTemplateText(draft.messageTemplate, sampleEmailTemplateValues);

  return (
    <div className="fixed inset-0 z-[220] grid place-items-center overflow-y-auto bg-[#0f1117]/55 px-3 py-6 backdrop-blur-sm sm:px-6">
      <button type="button" className="fixed inset-0 cursor-default" aria-label="Close email template editor" onClick={pending ? undefined : onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[calc(100svh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.08] px-4 py-3.5 sm:px-5">
          <div>
            <h3 id={titleId} className="text-[15px] font-bold text-[#0f1117]">{draft.id ? "Edit school email template" : "Create school email template"}</h3>
            <p className="mt-1 text-[11.5px] leading-5 text-[#5a6070]">Plain text and allowlisted placeholders only. Financial details remain server generated.</p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 disabled:cursor-not-allowed">
            <X className="size-4" /><span className="sr-only">Close editor</span>
          </button>
        </div>
        <form action={action} className="overflow-y-auto">
          <input type="hidden" name="templateId" value={draft.id ?? ""} />
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Template name" required>
                  <input autoFocus name="name" required minLength={3} maxLength={120} className={fieldControlClass} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="e.g. Monthly balance reminder" />
                </Field>
                <Field label="Reminder type" required>
                  <select name="reminderType" className={fieldControlClass} value={draft.reminderType} onChange={(event) => onChange({ ...draft, reminderType: event.target.value as PaymentReminderType })}>
                    <option value="tuition_due">Tuition due reminder</option>
                    <option value="overdue_notice">Overdue notice</option>
                    <option value="final_notice">Final notice</option>
                  </select>
                </Field>
              </div>
              <Field label="Email subject" required>
                <input name="subjectTemplate" required minLength={3} maxLength={220} className={fieldControlClass} value={draft.subjectTemplate} onChange={(event) => onChange({ ...draft, subjectTemplate: event.target.value })} />
              </Field>
              <Field label="Introductory message" required>
                <textarea name="messageTemplate" required minLength={10} maxLength={2000} rows={7} className={cn(fieldControlClass, "resize-y py-3 leading-5")} value={draft.messageTemplate} onChange={(event) => onChange({ ...draft, messageTemplate: event.target.value })} />
              </Field>
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">Insert placeholder into message</div>
                <div className="flex flex-wrap gap-2">
                  {emailTemplateVariableKeys.map((key) => (
                    <button key={key} type="button" onClick={() => onChange({ ...draft, messageTemplate: `${draft.messageTemplate}${draft.messageTemplate.endsWith(" ") || !draft.messageTemplate ? "" : " "}{{${key}}}` })} className="inline-flex min-h-10 items-center rounded-lg border border-black/10 bg-[#f7f8fa] px-3 font-mono text-[10.5px] text-[#5a6070] hover:border-[#e64a19]/35 hover:text-[#e64a19] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20">
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status" required>
                  <select name="status" className={fieldControlClass} value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as "active" | "inactive", isDefault: event.target.value === "inactive" ? false : draft.isDefault })}>
                    <option value="active">Active</option><option value="inactive">Inactive</option>
                  </select>
                </Field>
                <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-black/10 bg-[#f7f8fa] px-3 text-[12px] font-semibold text-[#0f1117]">
                  <input type="checkbox" name="isDefault" checked={draft.isDefault} disabled={draft.status === "inactive"} onChange={(event) => onChange({ ...draft, isDefault: event.target.checked })} className="size-4 accent-[#e64a19]" /> Default for this reminder type
                </label>
              </div>
            </div>
            <EmailPreviewCard subject={previewSubject} message={previewMessage} />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-black/[0.08] px-4 py-3.5 sm:flex-row sm:justify-end sm:px-5">
            <AdminButton type="button" tone="outline" className="w-full sm:w-auto" onClick={onClose} disabled={pending}>Cancel</AdminButton>
            <AdminButton type="submit" tone="primary" className="w-full sm:w-auto" disabled={pending}>{pending ? "Saving template..." : "Save template"}</AdminButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function TemplatePreview({ template, onClose }: { template: SchoolEmailTemplate; onClose: () => void }) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-[230] grid place-items-center overflow-y-auto bg-[#0f1117]/55 px-3 py-6 backdrop-blur-sm sm:px-6">
      <button type="button" className="fixed inset-0 cursor-default" aria-label="Close email preview" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.08] px-4 py-3.5 sm:px-5">
          <div><h3 id={titleId} className="text-[15px] font-bold text-[#0f1117]">Template preview</h3><p className="mt-1 text-[11.5px] text-[#5a6070]">Sample data only</p></div>
          <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg border border-black/10 bg-white text-[#5a6070] hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"><X className="size-4" /><span className="sr-only">Close preview</span></button>
        </div>
        <div className="p-4 sm:p-5"><EmailPreviewCard subject={renderEmailTemplateText(template.subjectTemplate, sampleEmailTemplateValues)} message={renderEmailTemplateText(template.messageTemplate, sampleEmailTemplateValues)} /></div>
      </section>
    </div>
  );
}

function EmailPreviewCard({ subject, message }: { subject: string; message: string }) {
  return (
    <aside className="self-start overflow-hidden rounded-lg border border-black/[0.08] bg-[#f4f5f7]">
      <div className="bg-[#0f1117] px-4 py-3 text-white"><div className="flex items-center gap-2 text-[13px] font-bold"><Mail className="size-4 text-[#e64a19]" /> XMETA Pay</div><div className="mt-1 text-[10.5px] text-[#c7cad1]">Sample Academy · 2026-2027</div></div>
      <div className="bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#e64a19]">Subject</div>
        <div className="mt-1 break-words text-[13px] font-bold leading-5 text-[#0f1117]">{subject || "Email subject preview"}</div>
        <div className="mt-4 whitespace-pre-wrap break-words text-[12.5px] leading-6 text-[#303443]">{message || "Message preview"}</div>
        <div className="mt-4 rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3 text-[11.5px] leading-5 text-[#5a6070]">XMETA Pay adds the student reference, fee balances, official deadlines, installment details, and secure parent portal action here.</div>
      </div>
    </aside>
  );
}

function templateToDraft(template: SchoolEmailTemplate, duplicate: boolean): TemplateDraft {
  return {
    id: duplicate ? null : template.id,
    reminderType: template.reminderType,
    name: duplicate ? `${template.name} copy` : template.name,
    subjectTemplate: template.subjectTemplate,
    messageTemplate: template.messageTemplate,
    status: "active",
    isDefault: false,
  };
}
