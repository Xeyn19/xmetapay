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

async function updateArchiveState(formData: FormData, operation: "archive" | "restore") {
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
      return actionState(
        "info",
        operation === "archive" ? "Fee not archived" : "Fee not restored",
        operation === "archive"
          ? "Only paid or zero-balance fees can be archived."
          : "The selected fee is no longer available in archived fees.",
      );
    }

    return actionState(
      "success",
      operation === "archive" ? "Fee summary archived" : "Fee summary restored",
      `${updatedIds.length} fee${updatedIds.length === 1 ? "" : "s"} ${operation === "archive" ? "archived" : "restored"}.`,
      updatedIds,
    );
  } catch {
    return actionState(
      "error",
      operation === "archive" ? "Fees not archived" : "Fees not restored",
      "Unable to update Fee summary. Confirm the parent fee archive migration is imported and try again.",
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
