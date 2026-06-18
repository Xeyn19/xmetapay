"use client";

import { Bell, CreditCard, Send, User, UserPlus, Users, X } from "lucide-react";

import { AdminButton, Field, fieldControlClass } from "./admin-ui";
import { cn } from "@/lib/utils";

export type AdminModalId = "enroll" | "payment" | "reminder";

export function AdminModals({
  activeModal,
  onClose,
}: {
  activeModal: AdminModalId | null;
  onClose: () => void;
}) {
  return (
    <>
      <Modal open={activeModal === "enroll"} title="Add / enroll student" onClose={onClose}>
        <div className="grid gap-5">
          <FormSection icon={User} title="Student information">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Last name" required><input className={fieldControlClass} placeholder="e.g. Santos" /></Field>
              <Field label="First name" required><input className={fieldControlClass} placeholder="e.g. Juan Miguel" /></Field>
              <Field label="Middle name"><input className={fieldControlClass} placeholder="Optional" /></Field>
              <Field label="Sex" required><select className={fieldControlClass}><option>Male</option><option>Female</option></select></Field>
              <Field label="Date of birth" required><input className={fieldControlClass} type="date" defaultValue="2012-03-12" /></Field>
              <Field label="Grade level" required>
                <select className={fieldControlClass} defaultValue="Grade 7">
                  {["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"].map((grade) => (
                    <option key={grade}>{grade}</option>
                  ))}
                </select>
              </Field>
              <Field label="Section"><input className={fieldControlClass} placeholder="e.g. Section A" /></Field>
              <Field label="Student type"><select className={fieldControlClass}><option>New</option><option>Transferee</option><option>Returnee</option></select></Field>
              <Field label="LRN"><input className={fieldControlClass} placeholder="12-digit (optional)" /></Field>
              <Field label="School year" required><select className={fieldControlClass}><option>2025-2026</option><option>2024-2025</option></select></Field>
            </div>
          </FormSection>
          <FormSection icon={Users} title="Parent / guardian">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Parent full name" required><input className={fieldControlClass} placeholder="Last, First" /></Field>
              <Field label="Relationship"><select className={fieldControlClass}><option>Mother</option><option>Father</option><option>Guardian</option></select></Field>
              <Field label="Contact number" required><input className={fieldControlClass} placeholder="09XX-XXX-XXXX" /></Field>
              <Field label="Email (for portal)"><input className={fieldControlClass} type="email" placeholder="parent@email.com" /></Field>
            </div>
          </FormSection>
        </div>
        <ModalFooter>
          <AdminButton onClick={onClose}>Cancel</AdminButton>
          <AdminButton tone="primary" onClick={onClose}><UserPlus className="size-4" />Enroll student</AdminButton>
        </ModalFooter>
      </Modal>

      <Modal open={activeModal === "payment"} title="Record manual payment" onClose={onClose}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Student" required><select className={fieldControlClass}><option>Juan Santos</option><option>Ben Torres</option><option>Miguel Tan</option></select></Field>
          <Field label="Fee type" required><select className={fieldControlClass}><option>June tuition</option><option>Books and modules</option><option>Allowance top-up</option></select></Field>
          <Field label="Amount" required><input className={fieldControlClass} placeholder="P0.00" /></Field>
          <Field label="Channel"><select className={fieldControlClass}><option>Cash</option><option>Bank transfer</option><option>XMETA wallet</option></select></Field>
          <Field label="Payment date"><input className={fieldControlClass} type="date" defaultValue="2025-05-19" /></Field>
          <Field label="Reference no."><input className={fieldControlClass} placeholder="Optional" /></Field>
          <Field label="Notes" className="sm:col-span-2"><textarea className={cn(fieldControlClass, "h-20 py-2")} placeholder="Internal note only" /></Field>
        </div>
        <ModalFooter>
          <AdminButton onClick={onClose}>Cancel</AdminButton>
          <AdminButton tone="primary" onClick={onClose}><CreditCard className="size-4" />Save payment</AdminButton>
        </ModalFooter>
      </Modal>

      <Modal open={activeModal === "reminder"} title="Send payment reminders" onClose={onClose}>
        <div className="grid gap-4">
          <div className="rounded-lg border border-[#f57c00]/20 bg-[#fff3e0] px-3.5 py-3 text-[12.5px] text-[#f57c00]">
            41 parents will receive a June tuition reminder. This is a UI-only preview; no messages will be sent.
          </div>
          <Field label="Audience" required><select className={fieldControlClass}><option>Unpaid and partial tuition accounts</option><option>Low allowance wallets</option><option>All parents</option></select></Field>
          <Field label="Channel"><select className={fieldControlClass}><option>SMS + email</option><option>SMS only</option><option>Email only</option></select></Field>
          <Field label="Message preview">
            <textarea
              className={cn(fieldControlClass, "h-28 py-2")}
              defaultValue="Good day. This is a reminder that your child's June tuition balance is still open in XMETA Pay. Please review your account when convenient."
            />
          </Field>
        </div>
        <ModalFooter>
          <AdminButton onClick={onClose}>Cancel</AdminButton>
          <AdminButton tone="primary" onClick={onClose}><Send className="size-4" />Queue reminders</AdminButton>
        </ModalFooter>
      </Modal>
    </>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f1117]/50 p-5"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-black/[0.07] bg-white">
        <header className="flex items-center justify-between gap-4 border-b border-black/[0.07] px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[#0f1117]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-black/15 text-[#5a6070] transition hover:bg-[#eff1f5]"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </section>
    </div>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Bell;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 border-b-2 border-[#fbe9e7] pb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-[#e64a19]">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 mt-5 flex justify-end gap-2 border-t border-black/[0.07] px-5 pt-4">
      {children}
    </div>
  );
}
