"use server";

import { revalidatePath } from "next/cache";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { requireRole } from "@/lib/auth/session";
import { updateTuitionCollectionArchiveState } from "@/lib/admin/tuition-collections";
import { getResolvedAdminSchoolViewSetup } from "@/lib/school/setup";

export type CollectionArchiveActionState = {
  status: "idle" | "success" | "info" | "error";
  title: string;
  description: string;
  submittedAt: number;
};

export async function archiveTuitionCollectionsAction(
  _prevState: CollectionArchiveActionState,
  formData: FormData,
): Promise<CollectionArchiveActionState> {
  return updateArchiveState(formData, "archive");
}

export async function restoreTuitionCollectionsAction(
  _prevState: CollectionArchiveActionState,
  formData: FormData,
): Promise<CollectionArchiveActionState> {
  return updateArchiveState(formData, "restore");
}

async function updateArchiveState(
  formData: FormData,
  operation: "archive" | "restore",
): Promise<CollectionArchiveActionState> {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    return actionState("error", "Access limited", "Only school administrators and finance officers can organize collection history.");
  }

  const setup = await getResolvedAdminSchoolViewSetup(session.userId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return actionState("error", "School year unavailable", setup.warning ?? "Choose a school year and try again.");
  }

  const paymentIds = [...new Set(
    formData.getAll("paymentIds")
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  )].slice(0, 100);

  if (paymentIds.length === 0) {
    return actionState("info", "No collections selected", "Select one or more tuition collection records first.");
  }

  try {
    const affected = await updateTuitionCollectionArchiveState({
      schoolId: setup.schoolId,
      schoolYearId: setup.schoolYearId,
      paymentIds,
      operation,
    });
    revalidatePath("/admin/collections");

    if (affected === 0) {
      return actionState(
        "info",
        operation === "archive" ? "Collection not archived" : "Collection not restored",
        "This tuition collection is no longer available in the selected school year.",
      );
    }

    return actionState(
      "success",
      operation === "archive" ? "Collection history archived" : "Collection history restored",
      `${affected} collection${affected === 1 ? "" : "s"} ${operation === "archive" ? "archived" : "restored"}.`,
    );
  } catch {
    return actionState(
      "error",
      operation === "archive" ? "Collections not archived" : "Collections not restored",
      "Unable to update collection history. Confirm the collection archive migration is imported and try again.",
    );
  }
}

function actionState(
  status: CollectionArchiveActionState["status"],
  title: string,
  description: string,
): CollectionArchiveActionState {
  return {
    status,
    title,
    description,
    submittedAt: Date.now(),
  };
}
