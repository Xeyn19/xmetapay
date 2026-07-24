"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { updateParentFeeArchiveState } from "@/lib/fees/parent-archive";

export type ParentFeeArchiveActionState = {
  status: "idle" | "success" | "info" | "error";
  title: string;
  description: string;
  updatedIds: number[];
  submittedAt: number;
};

export async function archiveParentFeeAssignmentsAction(
  _prevState: ParentFeeArchiveActionState,
  formData: FormData,
): Promise<ParentFeeArchiveActionState> {
  return updateArchiveState(formData, "archive");
}

export async function restoreParentFeeAssignmentsAction(
  _prevState: ParentFeeArchiveActionState,
  formData: FormData,
): Promise<ParentFeeArchiveActionState> {
  return updateArchiveState(formData, "restore");
}

export async function permanentlyDeleteParentFeeAssignmentsAction(
  _prevState: ParentFeeArchiveActionState,
  formData: FormData,
): Promise<ParentFeeArchiveActionState> {
  return updateArchiveState(formData, "delete");
}

async function updateArchiveState(
  formData: FormData,
  operation: "archive" | "restore" | "delete",
) {
  const session = await requireRole("parent");
  const assignmentIds = [...new Set(
    formData.getAll("feeAssignmentIds")
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  )].slice(0, 100);

  if (assignmentIds.length === 0) {
    return actionState("info", "No fees selected", "Select one or more settled fees first.");
  }

  try {
    const updatedIds = await updateParentFeeArchiveState({
      parentUserId: session.userId,
      assignmentIds,
      operation,
    });
    revalidatePath("/parent/fees");

    if (updatedIds.length === 0) {
      const title = operation === "archive"
        ? "Fee not archived"
        : operation === "restore"
          ? "Fee not restored"
          : "Fee not removed";
      const description = operation === "archive"
        ? "Only paid or zero-balance fees can be archived."
        : operation === "restore"
          ? "The selected fee is no longer available in archived fees."
          : "Only settled fees that are still in Archived fees can be permanently removed.";

      return actionState(
        "info",
        title,
        description,
      );
    }

    const title = operation === "archive"
      ? "Fee summary archived"
      : operation === "restore"
        ? "Fee summary restored"
        : "Fee permanently removed";
    const operationLabel = operation === "archive"
      ? "archived"
      : operation === "restore"
        ? "restored"
        : "removed";

    return actionState(
      "success",
      title,
      `${updatedIds.length} fee${updatedIds.length === 1 ? "" : "s"} ${operation === "delete" ? "permanently " : ""}${operationLabel}.`,
      updatedIds,
    );
  } catch {
    const title = operation === "archive"
      ? "Fees not archived"
      : operation === "restore"
        ? "Fees not restored"
        : "Fees not removed";

    return actionState(
      "error",
      title,
      "Unable to update Fee summary. Confirm the parent fee visibility migrations are imported and try again.",
    );
  }
}

function actionState(
  status: ParentFeeArchiveActionState["status"],
  title: string,
  description: string,
  updatedIds: number[] = [],
): ParentFeeArchiveActionState {
  return { status, title, description, updatedIds, submittedAt: Date.now() };
}
