"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

export type ReminderActionState = {
  status: "idle" | "success" | "info" | "error";
  title: string;
  description: string;
  submittedAt: number;
};

export async function logPaymentRemindersAction(
  _prevState: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  void _prevState;

  const context = await requireReminderContext();
  let connection: PoolConnection | null = null;

  try {
    const options = parseReminderOptions(formData);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const channelBindings = bindChannels(options.channels);
    const targetFilter = buildReminderTargetFilter(options);

    const [rows] = await connection.execute<ReminderCandidateRow[]>(
      `SELECT st.id AS student_id,
         sg.parent_user_id,
         st.first_name,
         st.middle_name,
         st.last_name,
         u.name AS parent_name,
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
       GROUP BY st.id, sg.parent_user_id, st.first_name, st.middle_name, st.last_name, u.name
       HAVING (
         SELECT COUNT(DISTINCT existing_reminder.channel)
         FROM notification_logs existing_reminder
         WHERE existing_reminder.school_id = :schoolId
           AND existing_reminder.recipient_user_id = sg.parent_user_id
           AND existing_reminder.student_id = st.id
           AND existing_reminder.type = 'payment_reminder'
           AND existing_reminder.channel IN (${channelBindings.sql})
           AND DATE(existing_reminder.created_at) = CURRENT_DATE
       ) < :channelCount
       ORDER BY open_balance DESC, st.last_name ASC, st.first_name ASC
       LIMIT 100`,
      {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        channelCount: options.channels.length,
        ...channelBindings.params,
        ...targetFilter.params,
      },
    );

    if (rows.length === 0) {
      const eligibleCount = await countEligibleReminderTargets(
        connection,
        context.schoolId,
        context.schoolYearId,
        targetFilter,
      );

      throw new ReminderValidationError(
        eligibleCount > 0
          ? "Each linked parent with an open balance already has a reminder for today."
          : "No linked parents currently have open or partial balances.",
        eligibleCount > 0 ? "Reminders already logged today" : "No reminders logged",
      );
    }

    let insertedCount = 0;

    for (const row of rows) {
      const existingChannels = await getExistingReminderChannels(
        connection,
        context.schoolId,
        row.parent_user_id,
        row.student_id,
        options.channels,
      );

      for (const channel of options.channels) {
        if (existingChannels.has(channel)) {
          continue;
        }

        await connection.execute<ResultSetHeader>(
          `INSERT INTO notification_logs (
             school_id, recipient_user_id, student_id, type, channel, status, message_body
           )
           VALUES (
             :schoolId, :recipientUserId, :studentId, 'payment_reminder', :channel, 'queued', :messageBody
           )`,
          {
            schoolId: context.schoolId,
            recipientUserId: row.parent_user_id,
            studentId: row.student_id,
            channel,
            messageBody: reminderMessageFor(row, options),
          },
        );
        insertedCount += 1;
      }
    }

    await connection.commit();
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/tuition");

    return actionToast(
      "success",
      "Payment reminders logged",
      `${insertedCount} ${options.channelLabel.toLowerCase()} ${options.reminderTypeLabel.toLowerCase()} ${
        insertedCount === 1 ? "record was" : "records were"
      } queued for ${rows.length} linked parent target${rows.length === 1 ? "" : "s"}.${
        options.customMessage ? " Custom message text was saved in reminder history." : ""
      }`,
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    return actionToast(
      error instanceof ReminderValidationError ? "info" : "error",
      error instanceof ReminderValidationError ? error.title : "Reminders not logged",
      error instanceof ReminderValidationError
        ? error.message
        : "Unable to create reminder history. Check MySQL/XAMPP and try again.",
    );
  } finally {
    connection?.release();
  }
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

async function getExistingReminderChannels(
  connection: PoolConnection,
  schoolId: number,
  parentUserId: number,
  studentId: number,
  channels: ReminderChannel[],
) {
  const channelBindings = bindChannels(channels);
  const [rows] = await connection.execute<ReminderChannelRow[]>(
    `SELECT channel
     FROM notification_logs
     WHERE school_id = :schoolId
       AND recipient_user_id = :parentUserId
       AND student_id = :studentId
       AND type = 'payment_reminder'
       AND channel IN (${channelBindings.sql})
       AND DATE(created_at) = CURRENT_DATE`,
    {
      schoolId,
      parentUserId,
      studentId,
      ...channelBindings.params,
    },
  );

  return new Set(rows.map((row) => row.channel));
}

async function requireReminderContext() {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canAccessFinance(staffRole)) {
    await toast("Access limited", "Only school administrators and finance officers can log payment reminders.");
    redirect("/admin/dashboard");
  }

  const setup = await getResolvedAdminSchoolSetup(session.userId);

  if (!setup.schoolId || !setup.schoolYearId) {
    await toast("School setup required", setup.warning ?? "Ask a school administrator to complete setup first.");
    redirect("/admin/dashboard");
  }

  return {
    schoolId: setup.schoolId,
    schoolYearId: setup.schoolYearId,
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
  constructor(message: string, readonly title = "Reminders not logged") {
    super(message);
  }
}

function parseReminderOptions(formData: FormData): ReminderOptions {
  const sendTo = stringValue(formData.get("sendTo"));
  const reminderType = stringValue(formData.get("reminderType"));
  const channel = stringValue(formData.get("channel"));
  const studentReference = stringValue(formData.get("studentReference"));
  const customMessage = stringValue(formData.get("customMessage"));

  if (sendTo === "specific_student" && !studentReference) {
    throw new ReminderValidationError("Enter the student reference for a specific reminder target.");
  }

  if (customMessage.length > 500) {
    throw new ReminderValidationError("Keep the optional reminder message under 500 characters.");
  }

  return {
    sendTo: sendTo === "overdue_tuition" || sendTo === "specific_student" ? sendTo : "all_unpaid",
    reminderType: reminderType === "overdue_notice" || reminderType === "final_notice" ? reminderType : "tuition_due",
    channels: channelsFor(channel),
    channelLabel: labelForReminderChannel(channel),
    reminderTypeLabel: labelForReminderType(reminderType),
    customMessage,
    studentReference,
  };
}

function reminderMessageFor(row: ReminderCandidateRow, options: ReminderOptions) {
  if (options.customMessage) {
    return options.customMessage;
  }

  const studentName = fullName(row.first_name, row.middle_name, row.last_name) || "your student";
  const balance = Number(row.open_balance);
  const balanceText = Number.isFinite(balance) ? `P${balance.toLocaleString("en-PH")}` : "an open balance";

  if (options.reminderType === "final_notice") {
    return `Final notice: ${studentName} still has ${balanceText} in unpaid school fees. Please settle this balance as soon as possible.`;
  }

  if (options.reminderType === "overdue_notice") {
    return `Overdue notice: ${studentName} has ${balanceText} in overdue tuition or school fees. Please review the parent portal.`;
  }

  return `Tuition due reminder: ${studentName} has ${balanceText} in unpaid school fees. Please review the parent portal.`;
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

function bindChannels(channels: ReminderChannel[]) {
  const params: Record<string, ReminderChannel> = {};
  const placeholders = channels.map((channel, index) => {
    const key = `channel${index}`;
    params[key] = channel;
    return `:${key}`;
  });

  return {
    sql: placeholders.join(", "),
    params,
  };
}

function channelsFor(value: string): ReminderChannel[] {
  if (value === "email") {
    return ["email"];
  }

  if (value === "sms") {
    return ["sms"];
  }

  return ["sms", "email"];
}

function labelForReminderChannel(value: string) {
  if (value === "email") {
    return "Email";
  }

  if (value === "sms") {
    return "SMS";
  }

  return "SMS + Email";
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

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

type ReminderChannel = "email" | "sms";

type ReminderOptions = {
  sendTo: "all_unpaid" | "overdue_tuition" | "specific_student";
  reminderType: "tuition_due" | "overdue_notice" | "final_notice";
  channels: ReminderChannel[];
  channelLabel: string;
  reminderTypeLabel: string;
  customMessage: string;
  studentReference: string;
};

type ReminderTargetFilter = {
  sql: string;
  params: Record<string, string>;
};

type CountRow = RowDataPacket & {
  total: number;
};

type ReminderChannelRow = RowDataPacket & {
  channel: ReminderChannel;
};

type ReminderCandidateRow = RowDataPacket & {
  student_id: number;
  parent_user_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  parent_name: string;
  open_balance: number | string;
};
