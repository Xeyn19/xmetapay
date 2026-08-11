import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import {
  builtInPaymentReminderTemplates,
  isPaymentReminderType,
  unsupportedEmailTemplateVariables,
  type PaymentReminderType,
  type SchoolEmailTemplate,
} from "./template-contract";

export type SchoolEmailTemplateLibrary = {
  templates: SchoolEmailTemplate[];
  warning: string | null;
};

export type SchoolEmailTemplateInput = {
  id: number | null;
  reminderType: PaymentReminderType;
  name: string;
  subjectTemplate: string;
  messageTemplate: string;
  isDefault: boolean;
  status: "active" | "inactive";
};

export class EmailTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailTemplateValidationError";
  }
}

export async function getSchoolEmailTemplateLibrary(schoolId: number): Promise<SchoolEmailTemplateLibrary> {
  try {
    const templates = await readSchoolTemplates(schoolId, false);
    return { templates: mergeWithBuiltIns(templates), warning: null };
  } catch {
    return {
      templates: mergeWithBuiltIns([]),
      warning: "Import the school email template migration to create and manage school-specific templates.",
    };
  }
}

export async function getActiveSchoolEmailTemplates(schoolId: number) {
  try {
    return mergeWithBuiltIns(await readSchoolTemplates(schoolId, true)).filter(
      (template) => template.status === "active",
    );
  } catch {
    return mergeWithBuiltIns([]);
  }
}

export async function resolvePaymentReminderTemplate(
  connection: PoolConnection,
  schoolId: number,
  reminderType: PaymentReminderType,
  reference: string,
) {
  if (reference.startsWith("school:")) {
    const templateId = Number(reference.slice("school:".length));
    if (!Number.isSafeInteger(templateId) || templateId <= 0) {
      throw new EmailTemplateValidationError("Choose a valid active email template.");
    }

    const [rows] = await connection.execute<SchoolTemplateRow[]>(
      `SELECT id, reminder_type, name, subject_template, message_template, is_default, status, updated_at
       FROM school_email_templates
       WHERE id = :templateId
         AND school_id = :schoolId
         AND reminder_type = :reminderType
         AND status = 'active'
       LIMIT 1
       FOR UPDATE`,
      { templateId, schoolId, reminderType },
    );
    const row = rows[0];
    if (!row) {
      throw new EmailTemplateValidationError("That email template is unavailable. Choose another template and try again.");
    }
    return rowToTemplate(row);
  }

  if (reference.startsWith("builtin:")) {
    const builtIn = builtInPaymentReminderTemplates.find(
      (template) => template.reference === reference && template.reminderType === reminderType,
    );
    if (!builtIn) {
      throw new EmailTemplateValidationError("Choose a template that matches the reminder type.");
    }
    return builtIn;
  }

  const [defaultRows] = await connection.execute<SchoolTemplateRow[]>(
    `SELECT id, reminder_type, name, subject_template, message_template, is_default, status, updated_at
     FROM school_email_templates
     WHERE school_id = :schoolId
       AND reminder_type = :reminderType
       AND status = 'active'
       AND is_default = 1
     ORDER BY updated_at DESC, id DESC
     LIMIT 1
     FOR UPDATE`,
    { schoolId, reminderType },
  );

  return defaultRows[0]
    ? rowToTemplate(defaultRows[0])
    : builtInPaymentReminderTemplates.find((template) => template.reminderType === reminderType)!;
}

export async function saveSchoolEmailTemplate(
  schoolId: number,
  userId: number,
  rawInput: SchoolEmailTemplateInput,
) {
  const input = validateEmailTemplateInput(rawInput);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await lockSchool(connection, schoolId);

    if (input.isDefault) {
      await connection.execute(
        `UPDATE school_email_templates
         SET is_default = 0, updated_by = :userId
         WHERE school_id = :schoolId AND reminder_type = :reminderType AND is_default = 1`,
        { schoolId, reminderType: input.reminderType, userId },
      );
    }

    if (input.id) {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE school_email_templates
         SET reminder_type = :reminderType,
             name = :name,
             subject_template = :subjectTemplate,
             message_template = :messageTemplate,
             is_default = :isDefault,
             status = :status,
             updated_by = :userId
         WHERE id = :id AND school_id = :schoolId`,
        { ...input, schoolId, userId, isDefault: input.isDefault ? 1 : 0 },
      );
      if (result.affectedRows === 0) {
        throw new EmailTemplateValidationError("That school email template no longer exists.");
      }
    } else {
      await connection.execute(
        `INSERT INTO school_email_templates (
           school_id, reminder_type, name, subject_template, message_template,
           is_default, status, created_by, updated_by
         ) VALUES (
           :schoolId, :reminderType, :name, :subjectTemplate, :messageTemplate,
           :isDefault, :status, :userId, :userId
         )`,
        { ...input, schoolId, userId, isDefault: input.isDefault ? 1 : 0 },
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    if (isDuplicateEntry(error)) {
      throw new EmailTemplateValidationError("Use a unique template name for this school.");
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function setSchoolEmailTemplateStatus(
  schoolId: number,
  userId: number,
  templateId: number,
  status: "active" | "inactive",
) {
  if (!Number.isSafeInteger(templateId) || templateId <= 0) {
    throw new EmailTemplateValidationError("Choose a valid school email template.");
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE school_email_templates
     SET status = :status,
         is_default = CASE WHEN :status = 'inactive' THEN 0 ELSE is_default END,
         updated_by = :userId
     WHERE id = :templateId AND school_id = :schoolId`,
    { schoolId, userId, templateId, status },
  );

  if (result.affectedRows === 0) {
    throw new EmailTemplateValidationError("That school email template no longer exists.");
  }
}

function validateEmailTemplateInput(input: SchoolEmailTemplateInput): SchoolEmailTemplateInput {
  if (!isPaymentReminderType(input.reminderType)) {
    throw new EmailTemplateValidationError("Choose a supported payment reminder type.");
  }
  const name = input.name.trim();
  const subjectTemplate = input.subjectTemplate.trim();
  const messageTemplate = input.messageTemplate.trim();
  if (name.length < 3 || name.length > 120) {
    throw new EmailTemplateValidationError("Template names must be between 3 and 120 characters.");
  }
  if (subjectTemplate.length < 3 || subjectTemplate.length > 220) {
    throw new EmailTemplateValidationError("Email subjects must be between 3 and 220 characters.");
  }
  if (/[\r\n]/.test(subjectTemplate)) {
    throw new EmailTemplateValidationError("Email subjects must stay on one line.");
  }
  if (messageTemplate.length < 10 || messageTemplate.length > 2000) {
    throw new EmailTemplateValidationError("Template messages must be between 10 and 2,000 characters.");
  }
  const unsupported = unsupportedEmailTemplateVariables(`${subjectTemplate}\n${messageTemplate}`);
  if (unsupported.length > 0) {
    throw new EmailTemplateValidationError(`Unsupported placeholder${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}.`);
  }
  return {
    ...input,
    name,
    subjectTemplate,
    messageTemplate,
    isDefault: input.status === "active" && input.isDefault,
  };
}

async function readSchoolTemplates(schoolId: number, activeOnly: boolean) {
  const [rows] = await pool.execute<SchoolTemplateRow[]>(
    `SELECT id, reminder_type, name, subject_template, message_template, is_default, status, updated_at
     FROM school_email_templates
     WHERE school_id = :schoolId ${activeOnly ? "AND status = 'active'" : ""}
     ORDER BY reminder_type ASC, is_default DESC, name ASC`,
    { schoolId },
  );
  return rows.map(rowToTemplate);
}

function mergeWithBuiltIns(schoolTemplates: SchoolEmailTemplate[]) {
  const customDefaultTypes = new Set(
    schoolTemplates.filter((template) => template.status === "active" && template.isDefault).map((template) => template.reminderType),
  );
  const builtIns = builtInPaymentReminderTemplates.map((template) => ({
    ...template,
    isDefault: !customDefaultTypes.has(template.reminderType),
  }));
  return [...builtIns, ...schoolTemplates];
}

function rowToTemplate(row: SchoolTemplateRow): SchoolEmailTemplate {
  return {
    reference: `school:${row.id}`,
    id: row.id,
    source: "school",
    reminderType: row.reminder_type,
    name: row.name,
    subjectTemplate: row.subject_template,
    messageTemplate: row.message_template,
    status: row.status,
    isDefault: Boolean(row.is_default),
    editable: true,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

async function lockSchool(connection: PoolConnection, schoolId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT id FROM schools WHERE id = :schoolId LIMIT 1 FOR UPDATE",
    { schoolId },
  );
  if (!rows[0]) throw new EmailTemplateValidationError("School setup is unavailable.");
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY");
}

type SchoolTemplateRow = RowDataPacket & {
  id: number;
  reminder_type: PaymentReminderType;
  name: string;
  subject_template: string;
  message_template: string;
  is_default: number;
  status: "active" | "inactive";
  updated_at: Date | string;
};
