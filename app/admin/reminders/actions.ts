"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import {
  EmailConfigurationError,
  getEmailParentPortalUrl,
  sendPaymentReminderEmail,
  type PaymentReminderFee,
  verifyEmailTransport,
} from "@/lib/email/mailer";
import {
  renderEmailTemplateText,
  unsupportedEmailTemplateVariables,
  type EmailTemplateValues,
  type PaymentReminderType,
} from "@/lib/email/template-contract";
import { EmailTemplateValidationError, resolvePaymentReminderTemplate } from "@/lib/email/templates";
import { getResolvedAdminSchoolSetup, getResolvedAdminSchoolViewSetup } from "@/lib/school/setup";

export type ReminderActionState = {
  status: "idle" | "success" | "info" | "error";
  title: string;
  description: string;
  submittedAt: number;
};

export type ReminderArchiveActionState = ReminderActionState;

export async function archivePaymentRemindersAction(
  _prevState: ReminderArchiveActionState,
  formData: FormData,
): Promise<ReminderArchiveActionState> {
  return updatePaymentReminderArchiveState(formData, "archive");
}

export async function restorePaymentRemindersAction(
  _prevState: ReminderArchiveActionState,
  formData: FormData,
): Promise<ReminderArchiveActionState> {
  return updatePaymentReminderArchiveState(formData, "restore");
}

export async function sendPaymentReminderEmailsAction(
  _prevState: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  void _prevState;

  const context = await requireReminderContext();
  let options: ReminderOptions;

  try {
    options = parseReminderOptions(formData);
    await verifyEmailTransport();
  } catch (error) {
    return actionToast(
      error instanceof ReminderValidationError ? "info" : "error",
      error instanceof ReminderValidationError ? error.title : "Email service unavailable",
      error instanceof ReminderValidationError
        ? error.message
        : error instanceof EmailConfigurationError
          ? error.message
          : "Unable to verify the email service. Check the SMTP settings and try again.",
    );
  }

  const queuedReminders: QueuedReminder[] = [];
  let connection: PoolConnection | null = null;
  let transactionCommitted = false;
  let eligibleTargetCount = 0;
  let availableTargetCount = 0;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const targetFilter = buildReminderTargetFilter(options);
    eligibleTargetCount = await countEligibleReminderTargets(
      connection,
      context.schoolId,
      context.schoolYearId,
      targetFilter,
    );
    availableTargetCount = await countAvailableReminderTargets(
      connection,
      context.schoolId,
      context.schoolYearId,
      targetFilter,
    );

    const [rows] = await connection.execute<ReminderCandidateRow[]>(
      `SELECT st.id AS student_id,
         sg.parent_user_id,
         st.student_reference,
         st.first_name,
         st.middle_name,
         st.last_name,
         u.name AS parent_name,
         u.email AS parent_email,
         COALESCE(SUM(GREATEST(sfa.amount_due - sfa.amount_paid, 0)), 0) AS open_balance
       FROM student_fee_assignments sfa
       JOIN fee_types ft ON ft.id = sfa.fee_type_id
       JOIN students st ON st.id = sfa.student_id
       JOIN student_guardians sg ON sg.student_id = st.id
       JOIN users u ON u.id = sg.parent_user_id AND u.status = 'active'
       WHERE st.school_id = :schoolId
         AND sfa.school_year_id = :schoolYearId
         AND sfa.status IN ('open', 'partial')
         AND sfa.amount_due > sfa.amount_paid
         ${targetFilter.sql}
         AND NOT EXISTS (
           SELECT 1
           FROM notification_logs existing_reminder
           WHERE existing_reminder.school_id = :schoolId
             AND (existing_reminder.school_year_id = :schoolYearId OR existing_reminder.school_year_id IS NULL)
             AND existing_reminder.recipient_user_id = sg.parent_user_id
             AND existing_reminder.student_id = st.id
             AND existing_reminder.type = 'payment_reminder'
             AND existing_reminder.channel = 'email'
             AND DATE(existing_reminder.created_at) = CURRENT_DATE
             AND (
               existing_reminder.status = 'sent'
               OR (
                 existing_reminder.status = 'queued'
                 AND existing_reminder.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)
               )
             )
         )
       GROUP BY st.id, sg.parent_user_id, st.student_reference, st.first_name, st.middle_name, st.last_name, u.name, u.email
       ORDER BY open_balance DESC, st.last_name ASC, st.first_name ASC
       LIMIT 100`,
      {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        ...targetFilter.params,
      },
    );

    if (rows.length === 0) {
      throw new ReminderValidationError(
        eligibleTargetCount > 0
          ? "Each linked parent with an open balance already has a sent or recently queued email reminder today. Failed emails may be retried."
          : "No linked parents currently have open or partial balances.",
        eligibleTargetCount > 0 ? "Email reminders already sent today" : "No email reminders sent",
      );
    }

    const feeStatements = await getReminderFeeStatements(
      connection,
      context.schoolId,
      context.schoolYearId,
      rows,
      options,
    );
    const selectedTemplate = await resolvePaymentReminderTemplate(
      connection,
      context.schoolId,
      options.reminderType,
      options.templateReference,
    );
    const parentPortalUrl = getEmailParentPortalUrl();

    for (const row of rows) {
      const fees = feeStatements.get(row.student_id) ?? [];
      const outstandingBalance = formatBalance(
        fees.reduce((total, fee) => total + fee.balanceAmount, 0),
      );
      const earliestDueDate = earliestOfficialDueDate(fees);
      const studentName = fullName(row.first_name, row.middle_name, row.last_name) || "Student";
      const templateValues: EmailTemplateValues = {
        parent_name: row.parent_name,
        student_name: studentName,
        student_reference: row.student_reference,
        school_name: context.schoolName,
        school_year: context.schoolYearName,
        total_outstanding: outstandingBalance,
        earliest_due_date: earliestDueDate,
        parent_portal_url: parentPortalUrl,
      };
      const messageBody = renderEmailTemplateText(
        options.customMessage || selectedTemplate.messageTemplate,
        templateValues,
      );
      const subjectLine = renderEmailTemplateText(selectedTemplate.subjectTemplate, templateValues)
        .replace(/[\r\n]+/g, " ")
        .trim();
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO notification_logs (
           school_id, school_year_id, recipient_user_id, student_id, type, channel, status,
           message_body, email_template_id, email_template_name, subject_line
         )
         VALUES (
           :schoolId, :schoolYearId, :recipientUserId, :studentId, 'payment_reminder', 'email', 'queued',
           :messageBody, :emailTemplateId, :emailTemplateName, :subjectLine
         )`,
        {
          schoolId: context.schoolId,
          schoolYearId: context.schoolYearId,
          recipientUserId: row.parent_user_id,
          studentId: row.student_id,
          messageBody,
          emailTemplateId: selectedTemplate.id,
          emailTemplateName: selectedTemplate.name,
          subjectLine,
        },
      );

      queuedReminders.push({
        notificationId: insertResult.insertId,
        parentEmail: row.parent_email,
        parentName: row.parent_name,
        studentName,
        studentReference: row.student_reference,
        outstandingBalance,
        earliestDueDate,
        fees,
        messageBody,
        subjectLine,
      });
    }

    await connection.commit();
    transactionCommitted = true;
  } catch (error) {
    if (connection && !transactionCommitted) {
      await connection.rollback().catch(() => undefined);
    }

    const validationError = error instanceof ReminderValidationError || error instanceof EmailTemplateValidationError;
    return actionToast(
      validationError ? "info" : "error",
      error instanceof ReminderValidationError ? error.title : "Email reminders not sent",
      validationError
        ? error.message
        : "Unable to create email reminder history. Check MySQL/XAMPP and import the email template migration, then try again.",
    );
  } finally {
    connection?.release();
  }

  const deliveryResults = await Promise.all(
    queuedReminders.map(async (reminder) => {
      try {
        await sendPaymentReminderEmail({
          parentEmail: reminder.parentEmail,
          parentName: reminder.parentName,
          studentName: reminder.studentName,
          studentReference: reminder.studentReference,
          outstandingBalance: reminder.outstandingBalance,
          earliestDueDate: reminder.earliestDueDate,
          fees: reminder.fees,
          schoolName: context.schoolName,
          schoolYearName: context.schoolYearName,
          reminderType: options.reminderTypeLabel,
          subjectLine: reminder.subjectLine,
          messageBody: reminder.messageBody,
        });
        await updateReminderDeliveryStatus(reminder.notificationId, "sent");
        return true;
      } catch (error) {
        logSafeDeliveryError(error);
        await updateReminderDeliveryStatus(reminder.notificationId, "failed");
        return false;
      }
    }),
  );

  const sentCount = deliveryResults.filter(Boolean).length;
  const failedCount = deliveryResults.length - sentCount;
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/tuition");

  if (sentCount === 0) {
    return actionToast(
      "error",
      "Email reminders not sent",
      `${failedCount} email reminder${failedCount === 1 ? "" : "s"} failed. Check the SMTP configuration and retry.`,
    );
  }

  const duplicateCount = Math.max(0, eligibleTargetCount - availableTargetCount);
  const deferredCount = Math.max(0, availableTargetCount - queuedReminders.length);
  const summary = `${sentCount} sent, ${failedCount} failed, ${duplicateCount} already sent or queued today, ${queuedReminders.length} processed.${
    deferredCount > 0
      ? ` ${deferredCount} additional target${deferredCount === 1 ? " remains" : "s remain"} for another send because each request is limited to 100 emails.`
      : ""
  }`;

  return actionToast(
    failedCount > 0 ? "info" : "success",
    failedCount > 0 ? "Some email reminders were not sent" : "Email reminders sent",
    summary,
  );
}

async function updatePaymentReminderArchiveState(
  formData: FormData,
  operation: "archive" | "restore",
): Promise<ReminderArchiveActionState> {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    return actionToast("error", "Access limited", "Only school administrators and finance officers can manage reminder history.");
  }

  const setup = await getResolvedAdminSchoolViewSetup(session.userId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return actionToast("error", "School year unavailable", setup.warning ?? "Choose a school year and try again.");
  }

  const notificationIds = [...new Set(
    formData.getAll("notificationIds")
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  )].slice(0, 100);

  if (notificationIds.length === 0) {
    return actionToast("info", "No reminders selected", "Select one or more payment reminders first.");
  }

  const params: Record<string, number> = {
    schoolId: setup.schoolId,
    schoolYearId: setup.schoolYearId,
  };
  const placeholders = notificationIds.map((notificationId, index) => {
    const key = `notificationId${index}`;
    params[key] = notificationId;
    return `:${key}`;
  });
  const archiveAssignment = operation === "archive" ? "CURRENT_TIMESTAMP" : "NULL";
  const currentStateFilter = operation === "archive" ? "IS NULL" : "IS NOT NULL";

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notification_logs
       SET archived_at = ${archiveAssignment}
       WHERE id IN (${placeholders.join(", ")})
         AND school_id = :schoolId
         AND (school_year_id = :schoolYearId OR school_year_id IS NULL)
         AND type = 'payment_reminder'
         AND archived_at ${currentStateFilter}`,
      params,
    );
    const affected = result.affectedRows;
    const skipped = notificationIds.length - affected;

    revalidatePath("/admin/tuition");

    return actionToast(
      "success",
      operation === "archive" ? "Reminder history archived" : "Reminder history restored",
      `${affected} reminder${affected === 1 ? "" : "s"} ${operation === "archive" ? "archived" : "restored"}.${
        skipped > 0 ? ` ${skipped} skipped because they were unavailable or already updated.` : ""
      }`,
    );
  } catch {
    return actionToast(
      "error",
      operation === "archive" ? "Reminders not archived" : "Reminders not restored",
      "Unable to update reminder history. Confirm the archive migration is imported and try again.",
    );
  }
}

async function getReminderFeeStatements(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  candidates: ReminderCandidateRow[],
  options: ReminderOptions,
) {
  const studentIds = [...new Set(candidates.map((candidate) => candidate.student_id))];
  const params: Record<string, number> = { schoolId, schoolYearId };
  const studentPlaceholders = studentIds.map((studentId, index) => {
    const key = `statementStudentId${index}`;
    params[key] = studentId;
    return `:${key}`;
  });
  const scopeSql = options.sendTo === "overdue_tuition"
    ? "AND ft.category = 'tuition' AND sfa.due_date IS NOT NULL AND sfa.due_date < CURRENT_DATE"
    : "";
  const [feeRows] = await connection.execute<ReminderFeeRow[]>(
    `SELECT sfa.id AS assignment_id, sfa.student_id, ft.name AS fee_name, ft.category,
       sfa.amount_due, sfa.amount_paid, sfa.due_date, sfa.status
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id
     JOIN students st ON st.id = sfa.student_id
     WHERE st.school_id = :schoolId
       AND sfa.school_year_id = :schoolYearId
       AND sfa.student_id IN (${studentPlaceholders.join(", ")})
       AND sfa.status IN ('open', 'partial')
       AND sfa.amount_due > sfa.amount_paid
       ${scopeSql}
     ORDER BY st.id, sfa.due_date IS NULL, sfa.due_date, ft.name, sfa.id`,
    params,
  );

  const termsByAssignment = await getReminderTerms(connection, feeRows.map((row) => row.assignment_id));
  const feesByStudent = new Map<number, PaymentReminderFee[]>();

  for (const row of feeRows) {
    const amountDue = decimalValue(row.amount_due);
    const amountPaid = decimalValue(row.amount_paid);
    const fee: PaymentReminderFee = {
      name: row.fee_name,
      category: row.category,
      billed: formatBalance(amountDue),
      paid: formatBalance(amountPaid),
      balance: formatBalance(Math.max(0, amountDue - amountPaid)),
      balanceAmount: Math.max(0, amountDue - amountPaid),
      officialDueDate: formatOfficialDate(row.due_date),
      officialDueDateValue: dateValue(row.due_date),
      status: labelForStatus(row.status),
      terms: termsByAssignment.get(row.assignment_id) ?? [],
    };
    const studentFees = feesByStudent.get(row.student_id) ?? [];
    studentFees.push(fee);
    feesByStudent.set(row.student_id, studentFees);
  }

  return feesByStudent;
}

async function getReminderTerms(connection: PoolConnection, assignmentIds: number[]) {
  const termsByAssignment = new Map<number, PaymentReminderFee["terms"]>();

  if (assignmentIds.length === 0) {
    return termsByAssignment;
  }

  const params: Record<string, number> = {};
  const placeholders = assignmentIds.map((assignmentId, index) => {
    const key = `termAssignmentId${index}`;
    params[key] = assignmentId;
    return `:${key}`;
  });
  const [rows] = await connection.execute<ReminderTermRow[]>(
    `SELECT student_fee_assignment_id, term_name, amount_due, amount_paid, due_date, status
     FROM tuition_payment_terms
     WHERE student_fee_assignment_id IN (${placeholders.join(", ")})
       AND status <> 'cancelled'
     ORDER BY student_fee_assignment_id, sort_order, id`,
    params,
  );

  for (const row of rows) {
    const amountDue = decimalValue(row.amount_due);
    const amountPaid = decimalValue(row.amount_paid);
    const terms = termsByAssignment.get(row.student_fee_assignment_id) ?? [];
    terms.push({
      name: row.term_name,
      billed: formatBalance(amountDue),
      paid: formatBalance(amountPaid),
      balance: formatBalance(Math.max(0, amountDue - amountPaid)),
      scheduleDate: formatOfficialDate(row.due_date),
      status: labelForStatus(row.status),
    });
    termsByAssignment.set(row.student_fee_assignment_id, terms);
  }

  return termsByAssignment;
}

async function countEligibleReminderTargets(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  targetFilter: ReminderTargetFilter,
) {
  const [rows] = await connection.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM (
       SELECT st.id AS student_id, sg.parent_user_id
       FROM student_fee_assignments sfa
       JOIN fee_types ft ON ft.id = sfa.fee_type_id
       JOIN students st ON st.id = sfa.student_id
       JOIN student_guardians sg ON sg.student_id = st.id
       JOIN users u ON u.id = sg.parent_user_id AND u.status = 'active'
       WHERE st.school_id = :schoolId
         AND sfa.school_year_id = :schoolYearId
         AND sfa.status IN ('open', 'partial')
         AND sfa.amount_due > sfa.amount_paid
         ${targetFilter.sql}
       GROUP BY st.id, sg.parent_user_id
     ) eligible_targets`,
    { schoolId, schoolYearId, ...targetFilter.params },
  );

  return Number(rows[0]?.total ?? 0);
}

async function countAvailableReminderTargets(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  targetFilter: ReminderTargetFilter,
) {
  const [rows] = await connection.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM (
       SELECT st.id AS student_id, sg.parent_user_id
       FROM student_fee_assignments sfa
       JOIN fee_types ft ON ft.id = sfa.fee_type_id
       JOIN students st ON st.id = sfa.student_id
       JOIN student_guardians sg ON sg.student_id = st.id
       JOIN users u ON u.id = sg.parent_user_id AND u.status = 'active'
       WHERE st.school_id = :schoolId
         AND sfa.school_year_id = :schoolYearId
         AND sfa.status IN ('open', 'partial')
         AND sfa.amount_due > sfa.amount_paid
         ${targetFilter.sql}
         AND NOT EXISTS (
           SELECT 1
           FROM notification_logs existing_reminder
           WHERE existing_reminder.school_id = :schoolId
             AND (existing_reminder.school_year_id = :schoolYearId OR existing_reminder.school_year_id IS NULL)
             AND existing_reminder.recipient_user_id = sg.parent_user_id
             AND existing_reminder.student_id = st.id
             AND existing_reminder.type = 'payment_reminder'
             AND existing_reminder.channel = 'email'
             AND DATE(existing_reminder.created_at) = CURRENT_DATE
             AND (
               existing_reminder.status = 'sent'
               OR (
                 existing_reminder.status = 'queued'
                 AND existing_reminder.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)
               )
             )
         )
       GROUP BY st.id, sg.parent_user_id
     ) available_targets`,
    { schoolId, schoolYearId, ...targetFilter.params },
  );

  return Number(rows[0]?.total ?? 0);
}

async function updateReminderDeliveryStatus(notificationId: number, status: "sent" | "failed") {
  try {
    await pool.execute(
      `UPDATE notification_logs
       SET status = :status,
           sent_at = CASE WHEN :status = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = :notificationId AND channel = 'email'`,
      { notificationId, status },
    );
  } catch (error) {
    logSafeDeliveryError(error);
  }
}

async function requireReminderContext(): Promise<ReminderContext> {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    await toast("Access limited", "Only school administrators and finance officers can send payment reminder emails.");
    redirect("/admin/dashboard");
  }

  const setup = await getResolvedAdminSchoolSetup(session.userId);

  if (!setup.schoolId || !setup.schoolYearId || !setup.schoolYearName) {
    await toast("School setup required", setup.warning ?? "Ask a school administrator to complete setup first.");
    redirect("/admin/dashboard");
  }

  const [schoolRows] = await pool.execute<SchoolNameRow[]>(
    "SELECT name FROM schools WHERE id = :schoolId LIMIT 1",
    { schoolId: setup.schoolId },
  );

  return {
    schoolId: setup.schoolId,
    schoolYearId: setup.schoolYearId,
    schoolYearName: setup.schoolYearName,
    schoolName: schoolRows[0]?.name ?? "Your school",
  };
}

async function toast(title: string, description: string) {
  await setAuthFlashToast({
    role: "admin",
    title,
    description,
  });
}

function actionToast(status: ReminderActionState["status"], title: string, description: string): ReminderActionState {
  return {
    status,
    title,
    description,
    submittedAt: Date.now(),
  };
}

class ReminderValidationError extends Error {
  constructor(message: string, readonly title = "Email reminders not sent") {
    super(message);
  }
}

function parseReminderOptions(formData: FormData): ReminderOptions {
  const sendTo = stringValue(formData.get("sendTo"));
  const reminderType = stringValue(formData.get("reminderType"));
  const studentReference = stringValue(formData.get("studentReference"));
  const customMessage = stringValue(formData.get("customMessage"));
  const templateReference = stringValue(formData.get("templateReference"));

  if (sendTo === "specific_student" && !studentReference) {
    throw new ReminderValidationError("Enter the student reference for a specific reminder target.");
  }

  if (customMessage.length > 500) {
    throw new ReminderValidationError("Keep the optional reminder message under 500 characters.");
  }
  const unsupportedVariables = unsupportedEmailTemplateVariables(customMessage);
  if (unsupportedVariables.length > 0) {
    throw new ReminderValidationError(
      `Unsupported message placeholder${unsupportedVariables.length === 1 ? "" : "s"}: ${unsupportedVariables.join(", ")}.`,
    );
  }

  return {
    sendTo: sendTo === "overdue_tuition" || sendTo === "specific_student" ? sendTo : "all_unpaid",
    reminderType: reminderType === "overdue_notice" || reminderType === "final_notice" ? reminderType : "tuition_due",
    reminderTypeLabel: labelForReminderType(reminderType),
    templateReference,
    customMessage,
    studentReference,
  };
}

function buildReminderTargetFilter(options: ReminderOptions): ReminderTargetFilter {
  if (options.sendTo === "overdue_tuition") {
    return {
      sql: "AND ft.category = 'tuition' AND sfa.due_date IS NOT NULL AND sfa.due_date < CURRENT_DATE",
      params: {},
    };
  }

  if (options.sendTo === "specific_student") {
    return {
      sql: "AND st.student_reference = :studentReference",
      params: { studentReference: options.studentReference },
    };
  }

  return { sql: "", params: {} };
}

function labelForReminderType(value: string) {
  if (value === "overdue_notice") {
    return "Overdue notice";
  }

  if (value === "final_notice") {
    return "Final notice";
  }

  return "Tuition due reminder";
}

function fullName(firstName: string, middleName: string | null, lastName: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
}

function formatBalance(value: number | string) {
  const balance = Number(value);
  return Number.isFinite(balance)
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(balance)
    : "an open balance";
}

function decimalValue(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatOfficialDate(value: Date | string | null) {
  const date = dateValue(value);
  return date
    ? new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" }).format(date)
    : "Not set";
}

function earliestOfficialDueDate(fees: PaymentReminderFee[]) {
  const dates = fees
    .map((fee) => fee.officialDueDateValue)
    .filter((date): date is Date => date instanceof Date)
    .sort((left, right) => left.getTime() - right.getTime());

  return dates[0]
    ? new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" }).format(dates[0])
    : "Not set";
}

function labelForStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function logSafeDeliveryError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
  console.error("[payment-reminder-email]", { code });
}

type ReminderOptions = {
  sendTo: "all_unpaid" | "overdue_tuition" | "specific_student";
  reminderType: PaymentReminderType;
  reminderTypeLabel: string;
  templateReference: string;
  customMessage: string;
  studentReference: string;
};

type ReminderContext = {
  schoolId: number;
  schoolYearId: number;
  schoolYearName: string;
  schoolName: string;
};

type ReminderTargetFilter = {
  sql: string;
  params: Record<string, string>;
};

type QueuedReminder = {
  notificationId: number;
  parentEmail: string;
  parentName: string;
  studentName: string;
  studentReference: string;
  outstandingBalance: string;
  earliestDueDate: string;
  fees: PaymentReminderFee[];
  messageBody: string;
  subjectLine: string;
};

type CountRow = RowDataPacket & {
  total: number;
};

type SchoolNameRow = RowDataPacket & {
  name: string;
};

type ReminderCandidateRow = RowDataPacket & {
  student_id: number;
  parent_user_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  student_reference: string;
  parent_name: string;
  parent_email: string;
  open_balance: number | string;
};

type ReminderFeeRow = RowDataPacket & {
  assignment_id: number;
  student_id: number;
  fee_name: string;
  category: "tuition" | "other" | "allowance";
  amount_due: number | string;
  amount_paid: number | string;
  due_date: Date | string | null;
  status: string;
};

type ReminderTermRow = RowDataPacket & {
  student_fee_assignment_id: number;
  term_name: string;
  amount_due: number | string;
  amount_paid: number | string;
  due_date: Date | string;
  status: string;
};
