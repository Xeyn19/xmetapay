import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/auth/db";

export type GuardianEmailInput = { email: string; name: string; relationship: string };

type ParentRow = RowDataPacket & { id: number; status: string; school_id: number | null };
type AssignmentRow = RowDataPacket & { id: number; student_id: number; relationship: "mother" | "father" | "guardian" };
export type PendingGuardianRow = { id: number; studentName: string; studentReference: string; email: string; name: string; relationship: string };

export function parseGuardianEmailInput(email: string, name: string, relationship: string): GuardianEmailInput | null {
  const normalizedEmail = email.trim().toLowerCase();
  const guardianName = name.trim();
  const normalizedRelationship = relationship.trim().toLowerCase();
  if (!normalizedEmail && !guardianName && !normalizedRelationship) return null;
  if (normalizedEmail.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || !guardianName || guardianName.length > 120
    || !["mother", "father", "guardian"].includes(normalizedRelationship)) {
    throw new Error("Enter a valid parent email, guardian name, and relationship together.");
  }
  return { email: normalizedEmail, name: guardianName, relationship: normalizedRelationship };
}

export async function recordGuardianEmail(
  connection: PoolConnection,
  schoolId: number,
  studentId: number,
  adminUserId: number,
  guardian: GuardianEmailInput | null,
) {
  if (!guardian) return "none" as const;
  const [parents] = await connection.execute<ParentRow[]>(
    `SELECT u.id, u.status, pp.school_id FROM users u
     LEFT JOIN parent_profiles pp ON pp.user_id = u.id
     WHERE u.role = 'parent' AND u.email = :email LIMIT 1 FOR UPDATE`,
    { email: guardian.email },
  );
  const parent = parents[0];
  if (parent && parent.school_id !== schoolId) {
    throw new Error("This parent account belongs to another school or needs school assignment. Check the email.");
  }
  await connection.execute(
    `INSERT INTO pending_student_guardians
       (school_id, student_id, parent_email, guardian_name, relationship, created_by_user_id)
     VALUES (:schoolId, :studentId, :email, :name, :relationship, :adminUserId)`,
    { schoolId, studentId, email: guardian.email, name: guardian.name, relationship: guardian.relationship, adminUserId },
  );
  if (parent?.status !== "active") return "pending" as const;
  await linkRecordedGuardian(connection, studentId, parent.id, guardian.relationship as AssignmentRow["relationship"]);
  await connection.execute(
    `UPDATE pending_student_guardians SET status = 'linked', parent_user_id = :parentUserId
     WHERE student_id = :studentId AND parent_email = :email`,
    { studentId, email: guardian.email, parentUserId: parent.id },
  );
  return "linked" as const;
}

export async function getPendingGuardianAssignments(connection: PoolConnection, schoolId: number, email: string) {
  const [rows] = await connection.execute<AssignmentRow[]>(
    `SELECT pg.id, pg.student_id, pg.relationship
     FROM pending_student_guardians pg
     JOIN students st ON st.id = pg.student_id AND st.school_id = pg.school_id
     WHERE pg.school_id = :schoolId AND pg.parent_email = :email AND pg.status = 'pending'
     ORDER BY pg.id FOR UPDATE`,
    { schoolId, email: email.trim().toLowerCase() },
  );
  return rows;
}

export async function applyGuardianAssignments(connection: PoolConnection, schoolId: number, email: string, parentUserId: number) {
  const assignments = await getPendingGuardianAssignments(connection, schoolId, email);
  for (const assignment of assignments) {
    await linkRecordedGuardian(connection, assignment.student_id, parentUserId, assignment.relationship);
    await connection.execute(
      `UPDATE pending_student_guardians SET status = 'linked', parent_user_id = :parentUserId
       WHERE id = :id AND status = 'pending'`,
      { parentUserId, id: assignment.id },
    );
  }
  return assignments.length;
}

export async function listPendingGuardianEmails(schoolId: number): Promise<PendingGuardianRow[] | null> {
  try {
    const [rows] = await pool.execute<(RowDataPacket & {
      id: number; first_name: string; last_name: string; student_reference: string;
      parent_email: string; guardian_name: string; relationship: string;
    })[]>(
      `SELECT pg.id, pg.parent_email, pg.guardian_name, pg.relationship,
         st.first_name, st.last_name, st.student_reference
       FROM pending_student_guardians pg
       JOIN students st ON st.id = pg.student_id AND st.school_id = pg.school_id
       WHERE pg.school_id = :schoolId AND pg.status = 'pending'
       ORDER BY pg.created_at DESC, pg.id DESC LIMIT 100`,
      { schoolId },
    );
    return rows.map((row) => ({
      id: row.id, studentName: `${row.first_name} ${row.last_name}`, studentReference: row.student_reference,
      email: row.parent_email, name: row.guardian_name, relationship: row.relationship,
    }));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}

export async function changePendingGuardianEmail(
  connection: PoolConnection, schoolId: number, assignmentId: number,
  guardian: GuardianEmailInput | null,
) {
  const [rows] = await connection.execute<AssignmentRow[]>(
    `SELECT pg.id, pg.student_id, pg.relationship FROM pending_student_guardians pg
     JOIN students st ON st.id = pg.student_id AND st.school_id = pg.school_id
     WHERE pg.id = :assignmentId AND pg.school_id = :schoolId AND pg.status = 'pending'
     LIMIT 1 FOR UPDATE`,
    { assignmentId, schoolId },
  );
  const assignment = rows[0];
  if (!assignment) throw new Error("This pending parent connection is no longer available.");
  if (!guardian) {
    await connection.execute("UPDATE pending_student_guardians SET status = 'cancelled' WHERE id = :assignmentId", { assignmentId });
    return "cancelled" as const;
  }
  const [parents] = await connection.execute<ParentRow[]>(
    `SELECT u.id, u.status, pp.school_id FROM users u
     LEFT JOIN parent_profiles pp ON pp.user_id = u.id
     WHERE u.role = 'parent' AND u.email = :email LIMIT 1 FOR UPDATE`,
    { email: guardian.email },
  );
  const parent = parents[0];
  if (parent && parent.school_id !== schoolId) throw new Error("This parent account belongs to another school or needs school assignment.");
  await connection.execute(
    `UPDATE pending_student_guardians
     SET parent_email = :email, guardian_name = :name, relationship = :relationship,
       status = :status, parent_user_id = :parentUserId
     WHERE id = :assignmentId AND school_id = :schoolId AND status = 'pending'`,
    { email: guardian.email, name: guardian.name, relationship: guardian.relationship,
      status: parent?.status === "active" ? "linked" : "pending", parentUserId: parent?.status === "active" ? parent.id : null,
      assignmentId, schoolId },
  );
  if (parent?.status === "active") {
    await linkRecordedGuardian(connection, assignment.student_id, parent.id, guardian.relationship as AssignmentRow["relationship"]);
    return "linked" as const;
  }
  return "updated" as const;
}

async function linkRecordedGuardian(
  connection: PoolConnection,
  studentId: number,
  parentUserId: number,
  relationship: AssignmentRow["relationship"],
) {
  const [rows] = await connection.execute<(RowDataPacket & { total: number })[]>(
    "SELECT COUNT(*) AS total FROM student_guardians WHERE student_id = :studentId",
    { studentId },
  );
  await connection.execute(
    `INSERT INTO student_guardians (student_id, parent_user_id, relationship, is_primary)
     VALUES (:studentId, :parentUserId, :relationship, :isPrimary)
     ON DUPLICATE KEY UPDATE id = id`,
    { studentId, parentUserId, relationship, isPrimary: Number(rows[0]?.total ?? 0) === 0 },
  );
}
