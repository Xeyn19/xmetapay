"use server";

import { redirect } from "next/navigation";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { linkParentToStudentByReference } from "@/lib/students/records";

export async function linkParentStudentAction(formData: FormData) {
  const session = await requireRole("parent");
  const studentReference = value(formData, "studentReference");
  const redirectTo = safeRedirectPath(value(formData, "redirectTo"));

  try {
    const result = await linkParentToStudentByReference(pool, session.userId, studentReference);

    await setAuthFlashToast({
      role: "parent",
      title: titleForResult(result),
      description: descriptionForResult(result),
    });
  } catch {
    await setAuthFlashToast({
      role: "parent",
      title: "Student not linked",
      description: "Check that MySQL/XAMPP is running and try again.",
    });
  }

  redirect(redirectTo);
}

function descriptionForResult(result: Awaited<ReturnType<typeof linkParentToStudentByReference>>) {
  if (result === "linked") {
    return "Your parent portal is now connected to that student record.";
  }

  if (result === "already_linked") {
    return "That student is already connected to your parent portal.";
  }

  if (result === "ambiguous") {
    return "That student reference matches more than one school. Ask the school admin to confirm the record.";
  }

  if (result === "missing_profile") {
    return "Your parent profile was not found. Please register again or contact the school.";
  }

  return "No student record was found for that reference yet.";
}

function titleForResult(result: Awaited<ReturnType<typeof linkParentToStudentByReference>>) {
  if (result === "linked") {
    return "Student linked";
  }

  if (result === "already_linked") {
    return "Student already linked";
  }

  return "Student not linked";
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
