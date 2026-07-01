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
  _formData: FormData,
): Promise<ReminderActionState> {
  void _prevState;
  void _formData;

  const context = await requireReminderContext();
  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

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
       LEFT JOIN notification_logs existing_reminder
         ON existing_reminder.school_id = :schoolId
        AND existing_reminder.recipient_user_id = sg.parent_user_id
        AND existing_reminder.student_id = st.id
        AND existing_reminder.type = 'payment_reminder'
        AND existing_reminder.channel = 'in_app'
        AND DATE(existing_reminder.created_at) = CURRENT_DATE
       WHERE st.school_id = :schoolId
         AND sfa.school_year_id = :schoolYearId
         AND sfa.status IN ('open', 'partial')
         AND sfa.amount_due > sfa.amount_paid
         AND existing_reminder.id IS NULL
       GROUP BY st.id, sg.parent_user_id, st.first_name, st.middle_name, st.last_name, u.name
       ORDER BY open_balance DESC, st.last_name ASC, st.first_name ASC
       LIMIT 100`,
      {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
      },
    );

    if (rows.length === 0) {
      const eligibleCount = await countEligibleReminderTargets(connection, context.schoolId, context.schoolYearId);

      throw new ReminderValidationError(
        eligibleCount > 0
          ? "Each linked parent with an open balance already has a reminder for today."
          : "No linked parents currently have open or partial balances.",
        eligibleCount > 0 ? "Reminders already logged today" : "No reminders logged",
      );
    }

    for (const row of rows) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO notification_logs (school_id, recipient_user_id, student_id, type, channel, status)
         VALUES (:schoolId, :recipientUserId, :studentId, 'payment_reminder', 'in_app', 'queued')`,
        {
          schoolId: context.schoolId,
          recipientUserId: row.parent_user_id,
          studentId: row.student_id,
        },
      );
    }

    await connection.commit();
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/tuition");

    return actionToast(
      "success",
      "Payment reminders logged",
      `${rows.length} in-app reminder ${rows.length === 1 ? "record was" : "records were"} queued for linked parents.`,
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

async function countEligibleReminderTargets(connection: PoolConnection, schoolId: number, schoolYearId: number) {
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
       GROUP BY st.id, sg.parent_user_id
     ) eligible_targets`,
    { schoolId, schoolYearId },
  );

  return Number(rows[0]?.total ?? 0);
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

type CountRow = RowDataPacket & {
  total: number;
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
