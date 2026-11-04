import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { pool } from "@/lib/auth/db";
import { getParentSchoolScope } from "@/lib/parents/school-scope";
import { getAdminSchoolContext } from "@/lib/school/setup";
import { linkParentToStudentByReference } from "@/lib/students/records";

export type StudentIdentityClaim = {
  reference: string;
  firstName: string;
  lastName: string;
};

export type ParentStudentLinkRequest = {
  id: number;
  parentName: string;
  parentEmail: string;
  relationship: string;
  studentReference: string;
  studentName: string;
  status: "Pending" | "Approved" | "Rejected";
  submittedAt: string;
};

export class StudentClaimError extends Error {
  constructor(
    message: string,
    readonly reason: "not_found" | "ambiguous" | "different_schools" | "invalid" | "forbidden" | "stale",
  ) {
    super(message);
    this.name = "StudentClaimError";
  }
}

export async function resolveRegistrationStudentClaims(
  connection: PoolConnection,
  email: string,
  claims: StudentIdentityClaim[],
  schoolCode?: string,
) {
  if (claims.length === 0) return resolveRegistrationByRecordedEmail(connection, email, schoolCode);
  if (claims.length > 10) throw new StudentClaimError("Add no more than 10 students.", "invalid");

  const params: Record<string, string> = {};
  const claimClauses = claims.map((claim, index) => {
    params[`reference${index}`] = claim.reference;
    params[`firstName${index}`] = claim.firstName;
    params[`lastName${index}`] = claim.lastName;
    return `(LOWER(TRIM(st.student_reference)) = LOWER(TRIM(:reference${index}))
      AND LOWER(TRIM(st.first_name)) = LOWER(TRIM(:firstName${index}))
      AND LOWER(TRIM(st.last_name)) = LOWER(TRIM(:lastName${index})))`;
  });
  const normalizedSchoolCode = schoolCode?.trim() ?? "";
  if (normalizedSchoolCode) params.schoolCode = normalizedSchoolCode;

  const [rows] = await connection.execute<StudentClaimMatchRow[]>(
    `SELECT st.id, st.school_id, st.student_reference, st.first_name, st.last_name
     FROM students st
     JOIN schools sc ON sc.id = st.school_id AND sc.status = 'active'
     WHERE (${claimClauses.join(" OR ")})
       ${normalizedSchoolCode ? "AND LOWER(sc.code) = LOWER(:schoolCode)" : ""}
     ORDER BY st.school_id, st.id`,
    params,
  );

  const matchedStudents = claims.map((claim) => rows.filter((row) => sameClaim(row, claim)));
  if (matchedStudents.some((matches) => matches.length === 0)) {
    throw new StudentClaimError("We could not verify the student details.", "not_found");
  }
  if (matchedStudents.some((matches) => matches.length > 1)) {
    throw new StudentClaimError("More information is needed to identify the school.", "ambiguous");
  }

  const uniqueRows = [...new Map(matchedStudents.map((matches) => [Number(matches[0].id), matches[0]])).values()];
  const schoolIds = new Set(uniqueRows.map((row) => Number(row.school_id)));
  if (schoolIds.size !== 1) {
    throw new StudentClaimError("All students on one Parent account must belong to the same school.", "different_schools");
  }

  return {
    schoolId: Number(uniqueRows[0].school_id),
    references: uniqueRows.map((row) => row.student_reference),
  };
}

export async function requestParentStudentLink(parentUserId: number, claim: StudentIdentityClaim) {
  const normalized = normalizeClaim(claim);
  if (!normalized.reference || !normalized.firstName || !normalized.lastName) {
    throw new StudentClaimError("Enter the student reference, first name, and last name.", "invalid");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const scope = await getParentSchoolScope(parentUserId, connection);
    if (!scope || scope.schoolStatus !== "active") throw new StudentClaimError("Your assigned school is not available for new requests.", "forbidden");

    const [parents] = await connection.execute<ParentClaimRow[]>(
      `SELECT u.email, pp.relationship
       FROM users u JOIN parent_profiles pp ON pp.user_id = u.id
       WHERE u.id = :parentUserId AND u.role = 'parent' AND pp.school_id = :schoolId
       LIMIT 1 FOR UPDATE`,
      { parentUserId, schoolId: scope.schoolId },
    );
    if (!parents[0]) throw new StudentClaimError("Parent profile was not found.", "forbidden");

    const [students] = await connection.execute<StudentClaimMatchRow[]>(
      `SELECT id, school_id, student_reference, first_name, last_name
       FROM students
       WHERE school_id = :schoolId
         AND LOWER(TRIM(student_reference)) = LOWER(TRIM(:reference))
         AND LOWER(TRIM(first_name)) = LOWER(TRIM(:firstName))
         AND LOWER(TRIM(last_name)) = LOWER(TRIM(:lastName))
       LIMIT 2 FOR UPDATE`,
      { schoolId: scope.schoolId, ...normalized },
    );
    if (students.length !== 1) throw new StudentClaimError("We could not verify the student details.", "not_found");
    const student = students[0];

    const [existingLinks] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM student_guardians WHERE student_id = :studentId AND parent_user_id = :parentUserId LIMIT 1",
      { studentId: student.id, parentUserId },
    );
    if (existingLinks.length) {
      await connection.commit();
      return "already_linked" as const;
    }

    const [recordedEmail] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM pending_student_guardians
       WHERE school_id = :schoolId AND student_id = :studentId
         AND parent_email = :email AND status = 'pending'
       LIMIT 1 FOR UPDATE`,
      { schoolId: scope.schoolId, studentId: student.id, email: parents[0].email },
    );
    if (recordedEmail[0]) {
      const linked = await linkParentToStudentByReference(connection, parentUserId, student.student_reference);
      if (linked !== "linked" && linked !== "already_linked") throw new StudentClaimError("The school-recorded connection could not be completed.", "stale");
      await connection.execute(
        `UPDATE pending_student_guardians SET status = 'linked', parent_user_id = :parentUserId
         WHERE id = :assignmentId AND status = 'pending'`,
        { parentUserId, assignmentId: recordedEmail[0].id },
      );
      await connection.commit();
      return "linked" as const;
    }

    const [existingRequests] = await connection.execute<LinkRequestRow[]>(
      `SELECT id, status FROM parent_student_link_requests
       WHERE parent_user_id = :parentUserId AND student_id = :studentId
       LIMIT 1 FOR UPDATE`,
      { parentUserId, studentId: student.id },
    );
    if (existingRequests[0]) {
      await connection.commit();
      return existingRequests[0].status === "pending" ? "pending" as const : existingRequests[0].status === "approved" ? "already_linked" as const : "rejected" as const;
    }

    await connection.execute(
      `INSERT INTO parent_student_link_requests
         (parent_user_id, school_id, student_id, student_reference_snapshot, student_name_snapshot, relationship_snapshot, status)
       VALUES
         (:parentUserId, :schoolId, :studentId, :reference, :studentName, :relationship, 'pending')`,
      {
        parentUserId,
        schoolId: scope.schoolId,
        studentId: student.id,
        reference: student.student_reference,
        studentName: `${student.first_name} ${student.last_name}`,
        relationship: parents[0].relationship,
      },
    );
    await connection.commit();
    return "pending" as const;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function getParentStudentLinkRequests(adminUserId: number): Promise<ParentStudentLinkRequest[]> {
  const context = await requireSchoolAdministrator(adminUserId);
  const [rows] = await pool.execute<AdminLinkRequestRow[]>(
    `SELECT r.id, r.status, r.created_at, r.student_reference_snapshot, r.student_name_snapshot,
            r.relationship_snapshot, u.name AS parent_name, u.email AS parent_email
     FROM parent_student_link_requests r
     JOIN users u ON u.id = r.parent_user_id AND u.role = 'parent'
     WHERE r.school_id = :schoolId
     ORDER BY r.status = 'pending' DESC, r.created_at DESC, r.id DESC`,
    { schoolId: context.schoolId },
  );
  return rows.map((row) => ({
    id: Number(row.id),
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    relationship: label(row.relationship_snapshot),
    studentReference: row.student_reference_snapshot,
    studentName: row.student_name_snapshot,
    status: row.status === "pending" ? "Pending" : row.status === "approved" ? "Approved" : "Rejected",
    submittedAt: new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(row.created_at)),
  }));
}

export async function reviewParentStudentLinkRequest(adminUserId: number, requestId: number, decision: "approve" | "reject") {
  const context = await requireSchoolAdministrator(adminUserId);
  if (!Number.isSafeInteger(requestId) || requestId <= 0) throw new StudentClaimError("Choose a valid connection request.", "invalid");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<ReviewRequestRow[]>(
      `SELECT r.parent_user_id, r.student_id, r.student_reference_snapshot, r.status
       FROM parent_student_link_requests r
       JOIN students st ON st.id = r.student_id AND st.school_id = r.school_id
       WHERE r.id = :requestId AND r.school_id = :schoolId
       LIMIT 1 FOR UPDATE`,
      { requestId, schoolId: context.schoolId },
    );
    const request = rows[0];
    if (!request || request.status !== "pending") throw new StudentClaimError("This connection request is no longer pending.", "stale");
    if (decision === "approve") {
      const linked = await linkParentToStudentByReference(connection, Number(request.parent_user_id), request.student_reference_snapshot);
      if (linked !== "linked" && linked !== "already_linked") throw new StudentClaimError("The student connection could not be completed.", "stale");
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE parent_student_link_requests
       SET status = :status, reviewer_user_id = :adminUserId, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = :requestId AND school_id = :schoolId AND status = 'pending'`,
      { status: decision === "approve" ? "approved" : "rejected", adminUserId, requestId, schoolId: context.schoolId },
    );
    if (result.affectedRows !== 1) throw new StudentClaimError("This request changed during review. Refresh and try again.", "stale");
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

async function resolveRegistrationByRecordedEmail(connection: PoolConnection, email: string, schoolCode?: string) {
  const [rows] = await connection.execute<RecordedEmailMatchRow[]>(
    `SELECT pg.school_id, st.student_reference
     FROM pending_student_guardians pg
     JOIN students st ON st.id = pg.student_id AND st.school_id = pg.school_id
     JOIN schools sc ON sc.id = pg.school_id AND sc.status = 'active'
     WHERE pg.parent_email = :email AND pg.status = 'pending'
       ${schoolCode?.trim() ? "AND LOWER(sc.code) = LOWER(:schoolCode)" : ""}
     ORDER BY pg.school_id, pg.id`,
    schoolCode?.trim() ? { email, schoolCode: schoolCode.trim() } : { email },
  );
  if (!rows.length) throw new StudentClaimError("Enter student details or ask the school to record your email.", "not_found");
  const schoolIds = new Set(rows.map((row) => Number(row.school_id)));
  if (schoolIds.size !== 1) throw new StudentClaimError("More information is needed to identify the school.", "ambiguous");
  return { schoolId: Number(rows[0].school_id), references: [...new Set(rows.map((row) => row.student_reference))] };
}

async function requireSchoolAdministrator(adminUserId: number) {
  if (await getAdminStaffRole(adminUserId) !== "school_administrator") throw new StudentClaimError("Only the school administrator can review connection requests.", "forbidden");
  const context = await getAdminSchoolContext(adminUserId);
  if (!context.schoolId) throw new StudentClaimError("Finish school setup before reviewing requests.", "forbidden");
  return context;
}

function normalizeClaim(claim: StudentIdentityClaim) {
  return { reference: claim.reference.trim(), firstName: claim.firstName.trim(), lastName: claim.lastName.trim() };
}

function sameClaim(row: StudentClaimMatchRow, claim: StudentIdentityClaim) {
  const normalized = normalizeClaim(claim);
  return row.student_reference.trim().toLocaleLowerCase() === normalized.reference.toLocaleLowerCase()
    && row.first_name.trim().toLocaleLowerCase() === normalized.firstName.toLocaleLowerCase()
    && row.last_name.trim().toLocaleLowerCase() === normalized.lastName.toLocaleLowerCase();
}

function label(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "Guardian";
}

type StudentClaimMatchRow = RowDataPacket & { id: number; school_id: number; student_reference: string; first_name: string; last_name: string };
type ParentClaimRow = RowDataPacket & { email: string; relationship: string };
type LinkRequestRow = RowDataPacket & { id: number; status: "pending" | "approved" | "rejected" };
type RecordedEmailMatchRow = RowDataPacket & { school_id: number; student_reference: string };
type AdminLinkRequestRow = RowDataPacket & { id: number; status: "pending" | "approved" | "rejected"; created_at: Date | string; student_reference_snapshot: string; student_name_snapshot: string; relationship_snapshot: string; parent_name: string; parent_email: string };
type ReviewRequestRow = RowDataPacket & { parent_user_id: number; student_id: number; student_reference_snapshot: string; status: "pending" | "approved" | "rejected" };
