"use server";

import { redirect } from "next/navigation";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageStudents } from "@/lib/admin/permissions";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import {
  createStudentForActiveYear,
  createStudentsForActiveYear,
  enrollExistingStudentsForActiveYear,
  isDuplicateEntry,
  type ExistingEnrollmentBatchResult,
  type StudentBatchResult,
} from "@/lib/students/enrollment";

export async function createStudentAction(formData: FormData) {
  const session = await requireStudentManager("Your staff role cannot add or enroll students.");

  try {
    const student = await createStudentForActiveYear(session.userId, formData);
    await setAuthFlashToast({
      role: "admin",
      title: "Student added",
      description: `${student.firstName} ${student.lastName} is enrolled for the active school year.`,
    });
  } catch (error) {
    await setAuthFlashToast({
      role: "admin",
      title: "Student not added",
      description: isDuplicateEntry(error)
        ? "That student reference already exists for this school."
        : messageForError(error),
    });
  }

  redirect("/admin/students");
}

export async function createStudentsBatchAction(formData: FormData) {
  const session = await requireStudentManager("Your staff role cannot add or enroll students.");

  try {
    const result = await createStudentsForActiveYear(session.userId, formData);
    await setAuthFlashToast({
      role: "admin",
      title: result.createdCount > 0 ? "Students added" : "Students not added",
      description: batchSummary(result),
    });
  } catch (error) {
    await setAuthFlashToast({ role: "admin", title: "Students not added", description: messageForError(error) });
  }

  redirect("/admin/students");
}

export async function enrollExistingStudentsBatchAction(formData: FormData) {
  const session = await requireStudentManager("Your staff role cannot enroll students.");

  try {
    const result = await enrollExistingStudentsForActiveYear(session.userId, formData);
    await setAuthFlashToast({
      role: "admin",
      title: result.enrolledCount > 0 ? "Students enrolled" : "No students enrolled",
      description: existingEnrollmentBatchSummary(result),
    });
  } catch (error) {
    await setAuthFlashToast({ role: "admin", title: "Students not enrolled", description: messageForError(error) });
  }

  redirect("/admin/students");
}

export async function enrollExistingStudentAction(formData: FormData) {
  const placementForm = new FormData();
  placementForm.set("placements", JSON.stringify([{
    studentId: positiveInteger(formData.get("studentId")),
    gradeLevelId: positiveInteger(formData.get("gradeLevelId")),
    sectionId: positiveInteger(formData.get("sectionId")),
    studentType: formValue(formData, "studentType"),
  }]));
  return enrollExistingStudentsBatchAction(placementForm);
}

async function requireStudentManager(message: string) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canManageStudents(staffRole)) {
    await setAuthFlashToast({
      role: "admin",
      title: "Student access unavailable",
      description: message,
    });
    redirect("/admin/students");
  }

  return session;
}

function batchSummary(result: StudentBatchResult) {
  const parts = [`${result.createdCount} student${result.createdCount === 1 ? "" : "s"} added.`];

  if (result.duplicateRows.length > 0) {
    parts.push(`${result.duplicateRows.length} skipped because the reference already exists (row${result.duplicateRows.length === 1 ? "" : "s"} ${result.duplicateRows.join(", ")}).`);
  }

  if (result.invalidRows.length > 0) {
    parts.push(`${result.invalidRows.length} row${result.invalidRows.length === 1 ? "" : "s"} need correction (row${result.invalidRows.length === 1 ? "" : "s"} ${result.invalidRows.join(", ")}).`);
  }

  return parts.join(" ");
}

function existingEnrollmentBatchSummary(result: ExistingEnrollmentBatchResult) {
  return [
    `${result.enrolledCount} student${result.enrolledCount === 1 ? "" : "s"} enrolled`,
    result.duplicateCount > 0 ? `${result.duplicateCount} already enrolled` : "",
    result.invalidCount > 0 ? `${result.invalidCount} row${result.invalidCount === 1 ? "" : "s"} need${result.invalidCount === 1 ? "s" : ""} correction` : "",
    result.skippedCount > 0 ? `${result.skippedCount} student${result.skippedCount === 1 ? "" : "s"} skipped` : "",
  ].filter(Boolean).join(". ") + ".";
}

function positiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function messageForError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Check that MySQL/XAMPP is running and the school setup is complete.";
}
