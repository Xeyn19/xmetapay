"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canAccessFinance } from "@/lib/admin/permissions";
import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

export async function logPaymentRemindersAction() {
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
       WHERE st.school_id = :schoolId
         AND sfa.school_year_id = :schoolYearId
         AND sfa.status IN ('open', 'partial')
         AND sfa.amount_due > sfa.amount_paid
       GROUP BY st.id, sg.parent_user_id, st.first_name, st.middle_name, st.last_name, u.name
       ORDER BY open_balance DESC, st.last_name ASC, st.first_name ASC
       LIMIT 100`,
      {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
      },
    );

    if (rows.length === 0) {
      throw new ReminderValidationError("No linked parents currently have open or partial balances.");
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
    await toast(
      "Payment reminders logged",
      `${rows.length} in-app reminder ${rows.length === 1 ? "record was" : "records were"} queued for linked parents.`,
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await toast(
      "Reminders not logged",
      error instanceof ReminderValidationError
        ? error.message
        : "Unable to create reminder history. Check MySQL/XAMPP and try again.",
    );
  } finally {
    connection?.release();
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/tuition");
  redirect("/admin/tuition#payment-reminders");
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

class ReminderValidationError extends Error {}

type ReminderCandidateRow = RowDataPacket & {
  student_id: number;
  parent_user_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  parent_name: string;
  open_balance: number | string;
};
