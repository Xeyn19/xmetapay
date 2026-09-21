import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getAdminStaffRole } from "@/lib/admin/access";
import { pool } from "@/lib/auth/db";
import { getAdminSchoolContext } from "@/lib/school/setup";
import { linkParentToStudentByReference } from "@/lib/students/records";
import { applyGuardianAssignments, getPendingGuardianAssignments } from "@/lib/students/guardian-email-links";

export type ParentRegistrationRequest = {
  userId: number;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  submittedAt: string;
  status: "Pending approval" | "Approved" | "Rejected" | "Disabled";
  references: Array<{ value: string; studentName: string | null; schoolRecorded?: boolean }>;
};

export type ReviewDecision = "approve" | "reject" | "reopen";

export class ParentRegistrationReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParentRegistrationReviewError";
  }
}

export async function hasParentRegistrationMatch(
  connection: PoolConnection,
  schoolId: number,
  email: string,
  references: string[],
): Promise<boolean> {
  const [recorded] = await connection.execute<RowDataPacket[]>(
    `SELECT pg.id FROM pending_student_guardians pg
     JOIN students st ON st.id = pg.student_id AND st.school_id = pg.school_id
     WHERE pg.school_id = :schoolId AND pg.parent_email = :email AND pg.status = 'pending'
     LIMIT 1`,
    { schoolId, email },
  );
  if (recorded.length > 0) return true;
  if (references.length === 0) return false;

  const parameters: Record<string, number | string> = { schoolId };
  const placeholders = references.map((reference, index) => {
    const key = `reference${index}`;
    parameters[key] = reference;
    return `:${key}`;
  });
  const [matches] = await connection.execute<RowDataPacket[]>(
    `SELECT st.id FROM students st
     WHERE st.school_id = :schoolId AND st.student_reference IN (${placeholders.join(", ")})
     LIMIT 1`,
    parameters,
  );
  return matches.length > 0;
}

export async function saveParentRegistrationReferences(
  connection: PoolConnection,
  parentUserId: number,
  schoolId: number,
  references: string[],
) {
  for (const studentReference of references) {
    await connection.execute(
      `INSERT INTO parent_registration_references (parent_user_id, school_id, student_reference)
       VALUES (:parentUserId, :schoolId, :studentReference)`,
      { parentUserId, schoolId, studentReference },
    );
  }
}

export async function getParentRegistrationRequests(adminUserId: number): Promise<ParentRegistrationRequest[]> {
  const schoolId = await requireReviewerSchool(adminUserId);
  const [requests] = await pool.execute<RequestRow[]>(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at, pp.relationship, u.status,
       (SELECT pr.decision FROM parent_registration_reviews pr
        WHERE pr.parent_user_id = u.id ORDER BY pr.id DESC LIMIT 1) AS latest_decision
     FROM users u
     JOIN parent_profiles pp ON pp.user_id = u.id
     WHERE u.role = 'parent' AND pp.school_id = :schoolId
       AND (u.status = 'pending' OR EXISTS (
         SELECT 1 FROM parent_registration_reviews pr WHERE pr.parent_user_id = u.id
       ))
     ORDER BY u.status = 'pending' DESC, u.created_at DESC, u.id DESC`,
    { schoolId },
  );

  if (requests.length === 0) {
    return [];
  }

  const [references] = await pool.execute<ReferenceRow[]>(
    `SELECT rr.parent_user_id, rr.student_reference,
       st.first_name, st.last_name
     FROM parent_registration_references rr
     JOIN parent_profiles pp ON pp.user_id = rr.parent_user_id AND pp.school_id = rr.school_id
     JOIN users u ON u.id = rr.parent_user_id AND u.role = 'parent'
     LEFT JOIN students st ON st.school_id = rr.school_id
       AND st.student_reference = rr.student_reference
     WHERE rr.school_id = :schoolId
       AND (u.status = 'pending' OR EXISTS (
         SELECT 1 FROM parent_registration_reviews pr WHERE pr.parent_user_id = u.id
       ))
     ORDER BY rr.parent_user_id, rr.id`,
    { schoolId },
  );
  const referencesByParent = new Map<number, ParentRegistrationRequest["references"]>();

  for (const reference of references) {
    const parentReferences = referencesByParent.get(reference.parent_user_id) ?? [];
    parentReferences.push({
      value: reference.student_reference,
      studentName: reference.first_name && reference.last_name
        ? `${reference.first_name} ${reference.last_name}`
        : null,
    });
    referencesByParent.set(reference.parent_user_id, parentReferences);
  }

  const [recorded] = await pool.execute<RecordedGuardianRow[]>(
    `SELECT u.id AS parent_user_id, st.student_reference, st.first_name, st.last_name
     FROM pending_student_guardians pg
     JOIN users u ON u.role = 'parent' AND u.email = pg.parent_email
     JOIN parent_profiles pp ON pp.user_id = u.id AND pp.school_id = pg.school_id
     JOIN students st ON st.id = pg.student_id AND st.school_id = pg.school_id
     WHERE pg.school_id = :schoolId AND pg.status IN ('pending', 'linked')
       AND (u.status = 'pending' OR EXISTS (
         SELECT 1 FROM parent_registration_reviews pr WHERE pr.parent_user_id = u.id
       ))
     ORDER BY pg.id`,
    { schoolId },
  );
  for (const item of recorded) {
    const parentReferences = referencesByParent.get(item.parent_user_id) ?? [];
    const existing = parentReferences.find((reference) => reference.value === item.student_reference);
    if (existing) existing.schoolRecorded = true;
    else parentReferences.push({
      value: item.student_reference,
      studentName: `${item.first_name} ${item.last_name}`,
      schoolRecorded: true,
    });
    referencesByParent.set(item.parent_user_id, parentReferences);
  }

  return requests.map((request) => ({
    userId: request.id,
    name: request.name,
    email: request.email,
    phone: request.phone ?? "Not on file",
    relationship: request.relationship[0].toUpperCase() + request.relationship.slice(1),
    submittedAt: new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" })
      .format(new Date(request.created_at)),
    status: request.status === "pending"
      ? "Pending approval"
      : request.status === "active"
        ? "Approved"
        : request.latest_decision === "rejected"
          ? "Rejected"
          : "Disabled",
    references: referencesByParent.get(request.id) ?? [],
  }));
}

export async function reviewParentRegistration(
  adminUserId: number,
  parentUserId: number,
  decision: ReviewDecision,
) {
  const schoolId = await requireReviewerSchool(adminUserId);
  if (!Number.isSafeInteger(parentUserId) || parentUserId <= 0) {
    throw new ParentRegistrationReviewError("Choose a valid parent registration.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<LockedRequestRow[]>(
      `SELECT u.status, u.email, sc.status AS school_status
       FROM users u
       JOIN parent_profiles pp ON pp.user_id = u.id
       JOIN schools sc ON sc.id = pp.school_id
       WHERE u.id = :parentUserId AND u.role = 'parent'
         AND pp.school_id = :schoolId
       LIMIT 1 FOR UPDATE`,
      { parentUserId, schoolId },
    );
    const request = rows[0];
    if (!request) {
      throw new ParentRegistrationReviewError("This registration is not available for your school.");
    }

    if (decision === "reopen") {
      const [reviews] = await connection.execute<LatestReviewRow[]>(
        `SELECT decision FROM parent_registration_reviews
         WHERE parent_user_id = :parentUserId AND school_id = :schoolId
         ORDER BY id DESC LIMIT 1`,
        { parentUserId, schoolId },
      );
      if (request.status !== "disabled" || reviews[0]?.decision !== "rejected") {
        throw new ParentRegistrationReviewError("This registration is no longer rejected.");
      }
    } else if (request.status !== "pending") {
      throw new ParentRegistrationReviewError("This registration has already been reviewed.");
    }

    if ((decision === "approve" || decision === "reopen") && request.school_status !== "active") {
      throw new ParentRegistrationReviewError("The school must be active before parent access can be reviewed.");
    }

    if (decision === "approve") {
      const recordedAssignments = await getPendingGuardianAssignments(connection, schoolId, request.email);
      const [matches] = await connection.execute<MatchedReferenceRow[]>(
        `SELECT rr.student_reference
         FROM parent_registration_references rr
         JOIN students st ON st.school_id = rr.school_id
           AND st.student_reference = rr.student_reference
         WHERE rr.parent_user_id = :parentUserId AND rr.school_id = :schoolId
         ORDER BY rr.id`,
        { parentUserId, schoolId },
      );
      if (matches.length === 0 && recordedAssignments.length === 0) {
        throw new ParentRegistrationReviewError("At least one reference or school-recorded parent email must match a student at this school.");
      }

      for (const match of matches) {
        const result = await linkParentToStudentByReference(connection, parentUserId, match.student_reference);
        if (result !== "linked" && result !== "already_linked") {
          throw new ParentRegistrationReviewError("The matched student could not be linked. Please try again.");
        }
      }
      await applyGuardianAssignments(connection, schoolId, request.email, parentUserId);
    }

    const nextStatus = decision === "approve" ? "active" : decision === "reject" ? "disabled" : "pending";
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE users SET status = :nextStatus
       WHERE id = :parentUserId AND role = 'parent' AND status = :currentStatus`,
      { nextStatus, parentUserId, currentStatus: request.status },
    );
    if (result.affectedRows !== 1) {
      throw new ParentRegistrationReviewError("This registration changed during review. Refresh and try again.");
    }

    if (decision === "reject") {
      await connection.execute(
        `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = :parentUserId AND revoked_at IS NULL`,
        { parentUserId },
      );
    }

    await connection.execute(
      `INSERT INTO parent_registration_reviews (parent_user_id, school_id, reviewer_user_id, decision)
       VALUES (:parentUserId, :schoolId, :adminUserId, :decision)`,
      {
        parentUserId,
        schoolId,
        adminUserId,
        decision: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "reopened",
      },
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function requireReviewerSchool(adminUserId: number) {
  const role = await getAdminStaffRole(adminUserId);
  if (role !== "school_administrator") {
    throw new ParentRegistrationReviewError("Only the school administrator can review parent registrations.");
  }
  const context = await getAdminSchoolContext(adminUserId);
  if (!context.schoolId) {
    throw new ParentRegistrationReviewError("Finish school setup before reviewing parent registrations.");
  }
  return context.schoolId;
}

type RequestRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  relationship: string;
  status: "active" | "pending" | "disabled";
  latest_decision: "approved" | "rejected" | "reopened" | null;
  created_at: Date | string;
};

type ReferenceRow = RowDataPacket & {
  parent_user_id: number;
  student_reference: string;
  first_name: string | null;
  last_name: string | null;
};

type LockedRequestRow = RowDataPacket & {
  status: "active" | "pending" | "disabled";
  email: string;
  school_status: "active" | "inactive";
};
type RecordedGuardianRow = RowDataPacket & {
  parent_user_id: number;
  student_reference: string;
  first_name: string;
  last_name: string;
};

type LatestReviewRow = RowDataPacket & { decision: "approved" | "rejected" | "reopened" };
type MatchedReferenceRow = RowDataPacket & { student_reference: string };
