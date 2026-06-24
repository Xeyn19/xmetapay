"use client";

import { CreditCard, Send, X } from "lucide-react";

import { AdminButton, Field, fieldControlClass } from "./admin-ui";
import { cn } from "@/lib/utils";

export type AdminModalId = "payment" | "reminder";

export function AdminModals({
  activeModal,
  onClose,
}: {
  activeModal: AdminModalId | null;
  onClose: () => void;
}) {
  return (
    <>
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f1117]/50 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="max-h-[calc(100svh-24px)] w-full max-w-xl overflow-y-auto rounded-xl border border-black/[0.07] bg-white sm:max-h-[90svh]">
        <header className="flex items-center justify-between gap-4 border-b border-black/[0.07] px-4 py-3.5 sm:px-5 sm:py-4">
          <h2 className="text-[15px] font-bold leading-5 text-[#0f1117]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/15 text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </section>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 mt-5 grid gap-2 border-t border-black/[0.07] px-4 pt-4 min-[420px]:flex min-[420px]:justify-end sm:-mx-5 sm:px-5">
      {children}
    </div>
  );
}
