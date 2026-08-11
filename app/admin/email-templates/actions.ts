"use server";

import { revalidatePath } from "next/cache";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import { requireRole } from "@/lib/auth/session";
import {
  EmailTemplateValidationError,
  saveSchoolEmailTemplate,
  setSchoolEmailTemplateStatus,
} from "@/lib/email/templates";
import { isPaymentReminderType } from "@/lib/email/template-contract";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

export type SchoolEmailTemplateActionState = {
  status: "idle" | "success" | "error";
  title: string;
  description: string;
  submittedAt: number;
};

export async function saveSchoolEmailTemplateAction(
  _previousState: SchoolEmailTemplateActionState,
  formData: FormData,
): Promise<SchoolEmailTemplateActionState> {
  void _previousState;
  const context = await requireTemplateManagementContext();
  if (!context.ok) return actionState("error", "Email template not saved", context.message);

  try {
    const reminderType = stringValue(formData.get("reminderType"));
    if (!isPaymentReminderType(reminderType)) {
      throw new EmailTemplateValidationError("Choose a supported payment reminder type.");
    }

    const idValue = stringValue(formData.get("templateId"));
    const id = idValue ? Number(idValue) : null;
    if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) {
      throw new EmailTemplateValidationError("Choose a valid school email template.");
    }

    await saveSchoolEmailTemplate(context.schoolId, context.userId, {
      id,
      reminderType,
      name: stringValue(formData.get("name")),
      subjectTemplate: stringValue(formData.get("subjectTemplate")),
      messageTemplate: stringValue(formData.get("messageTemplate")),
      isDefault: formData.get("isDefault") === "on",
      status: formData.get("status") === "inactive" ? "inactive" : "active",
    });

    revalidateTemplatePages();
    return actionState(
      "success",
      id ? "Email template updated" : "Email template created",
      "The school template is ready for payment reminders.",
    );
  } catch (error) {
    return actionState(
      "error",
      "Email template not saved",
      error instanceof EmailTemplateValidationError
        ? error.message
        : "Check that the email template migration is imported and try again.",
    );
  }
}

export async function toggleSchoolEmailTemplateAction(
  _previousState: SchoolEmailTemplateActionState,
  formData: FormData,
): Promise<SchoolEmailTemplateActionState> {
  void _previousState;
  const context = await requireTemplateManagementContext();
  if (!context.ok) return actionState("error", "Email template not updated", context.message);
  const templateId = Number(stringValue(formData.get("templateId")));
  const status = formData.get("nextStatus") === "inactive" ? "inactive" : "active";

  try {
    await setSchoolEmailTemplateStatus(context.schoolId, context.userId, templateId, status);
    revalidateTemplatePages();
    return actionState(
      "success",
      status === "active" ? "Email template activated" : "Email template deactivated",
      status === "active"
        ? "The template can now be selected for matching reminders."
        : "The template remains available for editing but cannot be selected for new reminders.",
    );
  } catch (error) {
    return actionState(
      "error",
      "Email template not updated",
      error instanceof EmailTemplateValidationError
        ? error.message
        : "Check that the email template migration is imported and try again.",
    );
  }
}

async function requireTemplateManagementContext() {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  if (!canManageSchoolSetup(staffRole)) {
    return { ok: false as const, message: "Only school administrators can manage school email templates." };
  }
  const setup = await getResolvedAdminSchoolSetup(session.userId);
  if (!setup.schoolId) {
    return { ok: false as const, message: "Complete school setup before managing email templates." };
  }
  return { ok: true as const, userId: session.userId, schoolId: setup.schoolId };
}

function revalidateTemplatePages() {
  revalidatePath("/admin/school-setup");
  revalidatePath("/admin/tuition");
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function actionState(
  status: SchoolEmailTemplateActionState["status"],
  title: string,
  description: string,
): SchoolEmailTemplateActionState {
  return { status, title, description, submittedAt: Date.now() };
}
