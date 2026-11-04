"use server";

import { redirect } from "next/navigation";

import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { requestParentStudentLink, StudentClaimError } from "@/lib/parents/student-claims";

export async function linkParentStudentAction(formData: FormData) {
  const session = await requireRole("parent");
  const studentReference = value(formData, "studentReference");
  const firstName = value(formData, "studentFirstName");
  const lastName = value(formData, "studentLastName");
  const redirectTo = safeRedirectPath(value(formData, "redirectTo"));

  try {
    const result = await requestParentStudentLink(session.userId, { reference: studentReference, firstName, lastName });

    await setAuthFlashToast({
      role: "parent",
      title: titleForResult(result),
      description: descriptionForResult(result),
    });
  } catch (error) {
    await setAuthFlashToast({
      role: "parent",
      title: "Student not linked",
      description: error instanceof StudentClaimError
        ? error.message
        : "Check that MySQL/XAMPP is running and try again.",
    });
  }

  redirect(redirectTo);
}

function descriptionForResult(result: Awaited<ReturnType<typeof requestParentStudentLink>>) {
  if (result === "linked") {
    return "Your parent portal is now connected to that student record.";
  }

  if (result === "already_linked") {
    return "That student is already connected to your parent portal.";
  }
  if (result === "pending") return "Your request was sent to the school administrator for approval.";
  if (result === "rejected") return "This connection request was not approved. Contact the school for help.";
  return "The student connection was verified using the guardian email recorded by the school.";
}

function titleForResult(result: Awaited<ReturnType<typeof requestParentStudentLink>>) {
  if (result === "linked") {
    return "Student linked";
  }

  if (result === "already_linked") {
    return "Student already linked";
  }
  if (result === "pending") return "Approval requested";
  return "Request not approved";
}

function safeRedirectPath(path: string) {
  if (path === "/parent/students" || path === "/parent/student-profile") {
    return path;
  }

  return "/parent/dashboard";
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);

  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}
