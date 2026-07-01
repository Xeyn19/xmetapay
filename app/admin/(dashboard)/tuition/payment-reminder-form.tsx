"use client";

import { useActionState, useEffect } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { logPaymentRemindersAction, type ReminderActionState } from "@/app/admin/reminders/actions";
import { AdminButton } from "../../_components/admin-ui";

const initialReminderActionState: ReminderActionState = {
  status: "idle",
  title: "",
  description: "",
  submittedAt: 0,
};

export function PaymentReminderForm() {
  const [state, formAction, pending] = useActionState(logPaymentRemindersAction, initialReminderActionState);

  useEffect(() => {
    if (state.status === "idle") {
      return;
    }

    const showToast = state.status === "error" ? toast.error : toast.success;

    showToast(state.title, {
      description: state.description,
    });
  }, [state]);

  return (
    <form action={formAction}>
      <AdminButton type="submit" tone="primary" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Logging..." : "Log reminders"}
      </AdminButton>
    </form>
  );
}
