"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import {
  ParentRegistrationReviewError,
  reviewParentRegistration,
  type ReviewDecision,
} from "@/lib/parents/registration-approval";

export async function reviewParentRegistrationAction(formData: FormData) {
  const session = await requireRole("admin");
  const parentUserId = Number(formData.get("parentUserId"));
  const rawDecision = formData.get("decision");
  const decision: ReviewDecision | null = rawDecision === "approve" || rawDecision === "reject" || rawDecision === "reopen"
    ? rawDecision
    : null;

  try {
    if (!decision) {
      throw new ParentRegistrationReviewError("Choose a valid review decision.");
    }
    await reviewParentRegistration(session.userId, parentUserId, decision);
    await setAuthFlashToast({
      role: "admin",
      title: decision === "approve" ? "Registration approved" : decision === "reject" ? "Registration rejected" : "Registration reopened",
      description: decision === "approve"
        ? "The parent can now sign in and view their linked students."
        : decision === "reject"
          ? "The parent cannot sign in. The request remains available for review."
          : "The registration is pending review again.",
    });
  } catch (error) {
    if (!(error instanceof ParentRegistrationReviewError)) {
      console.error("[parent-registration:review]", error);
    }
    await setAuthFlashToast({
      role: "admin",
      title: "Registration not updated",
      description: error instanceof ParentRegistrationReviewError
        ? error.message
        : "The review could not be saved. Check the database connection and try again.",
    });
  }

  revalidatePath("/admin/parents");
  redirect("/admin/parents");
}
