"use server";

import { revalidatePath } from "next/cache";

import { getAdminStaffRole } from "@/lib/admin/access";
import { updateAllowanceLedgerArchiveState } from "@/lib/admin/allowance-ledger";
import { canAccessFinance } from "@/lib/admin/permissions";
import { requireRole } from "@/lib/auth/session";
import { getResolvedAdminSchoolViewSetup } from "@/lib/school/setup";

export type AllowanceArchiveActionState = {
  status: "idle" | "success" | "info" | "error";
  title: string;
  description: string;
  submittedAt: number;
};

export async function archiveAllowanceWalletsAction(
  _prevState: AllowanceArchiveActionState,
  formData: FormData,
): Promise<AllowanceArchiveActionState> {
  return updateArchiveState(formData, "archive");
}

export async function restoreAllowanceWalletsAction(
  _prevState: AllowanceArchiveActionState,
  formData: FormData,
): Promise<AllowanceArchiveActionState> {
  return updateArchiveState(formData, "restore");
}

async function updateArchiveState(
  formData: FormData,
  operation: "archive" | "restore",
): Promise<AllowanceArchiveActionState> {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    return state("error", "Access limited", "Only school administrators and finance officers can organize allowance history.");
  }

  const setup = await getResolvedAdminSchoolViewSetup(session.userId);
  if (!setup.schoolId || !setup.schoolYearId) {
    return state("error", "School year unavailable", setup.warning ?? "Choose a school year and try again.");
  }

  const walletIds = [...new Set(
    formData.getAll("walletIds")
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  )].slice(0, 100);

  if (walletIds.length === 0) {
    return state("info", "No wallets selected", "Select one or more student wallets first.");
  }

  try {
    const affected = await updateAllowanceLedgerArchiveState({
      schoolId: setup.schoolId,
      schoolYearId: setup.schoolYearId,
      walletIds,
      operation,
    });

    revalidatePath("/admin/allowance");

    if (affected === 0) {
      return state("info", "Wallet not updated", "This wallet is no longer available in the selected school year.");
    }

    return state(
      "success",
      operation === "archive" ? "Allowance wallet archived" : "Allowance wallet restored",
      `${affected} wallet${affected === 1 ? "" : "s"} ${operation === "archive" ? "archived" : "restored"}.`,
    );
  } catch {
    return state(
      "error",
      operation === "archive" ? "Wallets not archived" : "Wallets not restored",
      "Unable to update the Allowance ledger. Confirm the wallet archive migration is imported and try again.",
    );
  }
}

function state(
  status: AllowanceArchiveActionState["status"],
  title: string,
  description: string,
): AllowanceArchiveActionState {
  return { status, title, description, submittedAt: Date.now() };
}
