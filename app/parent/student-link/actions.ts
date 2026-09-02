"use server";

import { redirect } from "next/navigation";

import { requireRole, setAuthFlashToast } from "@/lib/auth/session";

export async function linkParentStudentAction(formData: FormData) {
  await requireRole("parent");
  const redirectTo = safeRedirectPath(value(formData, "redirectTo"));
  await setAuthFlashToast({ role: "parent", title: "School invitation required", description: "Student references no longer grant parent access. Enter the invitation code emailed by your school." });

  redirect(redirectTo);
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
