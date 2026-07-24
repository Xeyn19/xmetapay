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

export async function permanentlyDeleteParentPaymentHistoryAction(
  _prevState: ParentPaymentHistoryArchiveActionState,
  formData: FormData,
): Promise<ParentPaymentHistoryArchiveActionState> {
  return updateArchiveState(formData, "delete");
}

export async function recoverRemovedParentPaymentHistoryAction(
  _prevState: ParentPaymentHistoryArchiveActionState,
  formData: FormData,
): Promise<ParentPaymentHistoryArchiveActionState> {
  return updateArchiveState(formData, "recover");
}

async function updateArchiveState(
  formData: FormData,
  operation: "archive" | "restore" | "delete" | "recover",
) {
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
      const title = operation === "archive"
        ? "Payment not archived"
        : operation === "restore"
          ? "Payment not restored"
          : operation === "delete"
            ? "Payment not removed"
            : "Payment not recovered";
      const description = operation === "archive"
        ? "Pending payments cannot be archived. Select a finished payment."
        : operation === "restore"
          ? "The selected payment is no longer available in archived history."
          : operation === "delete"
            ? "Only finished payments that are still in Archived payments can be removed."
            : "Only payments removed within the last 30 days can be restored to Archived.";

      return actionState(
        "info",
        title,
        description,
      );
    }

    const title = operation === "archive"
      ? "Payment history archived"
      : operation === "restore"
        ? "Payment history restored"
        : operation === "delete"
          ? "Payment removed"
          : "Payment restored to Archived";
    const operationLabel = operation === "archive"
      ? "archived"
      : operation === "restore"
        ? "restored"
        : operation === "delete"
          ? "removed"
          : "recovered";

    return actionState(
      "success",
      title,
      `${updatedIds.length} payment${updatedIds.length === 1 ? "" : "s"} ${operationLabel}.`,
      updatedIds,
    );
  } catch {
    const title = operation === "archive"
      ? "Payments not archived"
      : operation === "restore"
        ? "Payments not restored"
        : operation === "delete"
          ? "Payments not removed"
          : "Payments not recovered";

    return actionState(
      "error",
      title,
      "Unable to update Payment history. Confirm the parent payment visibility migrations are imported and try again.",
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
