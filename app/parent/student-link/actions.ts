"use server";

import { redirect } from "next/navigation";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { linkParentToStudentByReference } from "@/lib/students/records";

export async function linkParentStudentAction(formData: FormData) {
  const session = await requireRole("parent");
  const studentReference = value(formData, "studentReference");

  try {
    const result = await linkParentToStudentByReference(pool, session.userId, studentReference);

    await setAuthFlashToast({
      role: "parent",
      title: result === "linked" ? "Student linked" : "Student not linked",
      description: descriptionForResult(result),
    });
  } catch {
    await setAuthFlashToast({
      role: "parent",
      title: "Student not linked",
      description: "Check that MySQL/XAMPP is running and try again.",
    });
  }

  redirect("/parent/dashboard");
}

function descriptionForResult(result: Awaited<ReturnType<typeof linkParentToStudentByReference>>) {
  if (result === "linked") {
    return "Your parent portal is now connected to that student record.";
  }

  if (result === "ambiguous") {
    return "That student reference matches more than one school. Ask the school admin to confirm the record.";
  }

  if (result === "missing_profile") {
    return "Your parent profile was not found. Please register again or contact the school.";
  }

  return "No student record was found for that reference yet.";
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);

  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}
