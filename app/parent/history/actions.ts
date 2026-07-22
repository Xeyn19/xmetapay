"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { updateParentPaymentHistoryArchiveState } from "@/lib/payments/parent-history-archive";

export type ParentPaymentHistoryArchiveActionState = {
  status: "idle" | "success" | "info" | "error";
  title: string;
  description: string;
  updatedIds: number[];
  submittedAt: number;
};

export async function archiveParentPaymentHistoryAction(
  _prevState: ParentPaymentHistoryArchiveActionState,
  formData: FormData,
): Promise<ParentPaymentHistoryArchiveActionState> {
  return updateArchiveState(formData, "archive");
}

export async function restoreParentPaymentHistoryAction(
  _prevState: ParentPaymentHistoryArchiveActionState,
  formData: FormData,
): Promise<ParentPaymentHistoryArchiveActionState> {
  return updateArchiveState(formData, "restore");
}

async function updateArchiveState(formData: FormData, operation: "archive" | "restore") {
  const session = await requireRole("parent");
  const paymentIds = [...new Set(
    formData.getAll("paymentIds")
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  )].slice(0, 100);

  if (paymentIds.length === 0) {
    return actionState("info", "No payments selected", "Select one or more finished payments first.");
  }

  try {
    const updatedIds = await updateParentPaymentHistoryArchiveState({
      parentUserId: session.userId,
      paymentIds,
      operation,
    });
    revalidatePath("/parent/history");

    if (updatedIds.length === 0) {
      return actionState(
        "info",
        operation === "archive" ? "Payment not archived" : "Payment not restored",
        operation === "archive"
          ? "Pending payments cannot be archived. Select a finished payment."
          : "The selected payment is no longer available in archived history.",
      );
    }

    return actionState(
      "success",
      operation === "archive" ? "Payment history archived" : "Payment history restored",
      `${updatedIds.length} payment${updatedIds.length === 1 ? "" : "s"} ${operation === "archive" ? "archived" : "restored"}.`,
      updatedIds,
    );
  } catch {
    return actionState(
      "error",
      operation === "archive" ? "Payments not archived" : "Payments not restored",
      "Unable to update Payment history. Confirm the parent payment history archive migration is imported and try again.",
    );
  }
}

function actionState(
  status: ParentPaymentHistoryArchiveActionState["status"],
  title: string,
  description: string,
  updatedIds: number[] = [],
): ParentPaymentHistoryArchiveActionState {
  return { status, title, description, updatedIds, submittedAt: Date.now() };
}
