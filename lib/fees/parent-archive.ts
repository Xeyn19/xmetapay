import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type ParentFeeArchiveOperation = "archive" | "restore";

export async function updateParentFeeArchiveState({
  parentUserId,
  assignmentIds,
  operation,
}: {
  parentUserId: number;
  assignmentIds: number[];
  operation: ParentFeeArchiveOperation;
}) {
  const uniqueIds = [...new Set(assignmentIds)].slice(0, 100);

  if (uniqueIds.length === 0) {
    return [];
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const updatedIds = operation === "archive"
      ? await archiveSettledFees(connection, parentUserId, uniqueIds)
      : await restoreFees(connection, parentUserId, uniqueIds);
    await connection.commit();
    return updatedIds;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function archiveSettledFees(
  connection: PoolConnection,
  parentUserId: number,
  assignmentIds: number[],
) {
  const { placeholders, params } = idParams(assignmentIds);

  await connection.execute(
    `INSERT IGNORE INTO parent_fee_summary_archives
       (parent_user_id, student_fee_assignment_id, archived_at)
     SELECT :parentUserId, sfa.id, CURRENT_TIMESTAMP
     FROM student_fee_assignments sfa
     JOIN students st ON st.id = sfa.student_id
     JOIN student_guardians sg
       ON sg.student_id = st.id
      AND sg.parent_user_id = :parentUserId
     JOIN school_years sy
       ON sy.id = sfa.school_year_id
      AND sy.status = 'active'
     WHERE sfa.id IN (${placeholders})
       AND sfa.status <> 'cancelled'
       AND (sfa.status = 'paid' OR sfa.amount_paid >= sfa.amount_due)`,
    { parentUserId, ...params },
  );

  return getOwnedArchivedIds(connection, parentUserId, assignmentIds);
}

async function restoreFees(
  connection: PoolConnection,
  parentUserId: number,
  assignmentIds: number[],
) {
  const updatedIds = await getOwnedArchivedIds(connection, parentUserId, assignmentIds);

  if (updatedIds.length === 0) {
    return [];
  }

  const { placeholders, params } = idParams(updatedIds);
  await connection.execute(
    `DELETE FROM parent_fee_summary_archives
     WHERE parent_user_id = :parentUserId
       AND student_fee_assignment_id IN (${placeholders})`,
    { parentUserId, ...params },
  );
  return updatedIds;
}

async function getOwnedArchivedIds(
  connection: PoolConnection,
  parentUserId: number,
  assignmentIds: number[],
) {
  const { placeholders, params } = idParams(assignmentIds);
  const [rows] = await connection.execute<ArchiveIdRow[]>(
    `SELECT pfsa.student_fee_assignment_id
     FROM parent_fee_summary_archives pfsa
     JOIN student_fee_assignments sfa ON sfa.id = pfsa.student_fee_assignment_id
     JOIN students st ON st.id = sfa.student_id
     JOIN student_guardians sg
       ON sg.student_id = st.id
      AND sg.parent_user_id = :parentUserId
     JOIN school_years sy
       ON sy.id = sfa.school_year_id
      AND sy.status = 'active'
     WHERE pfsa.parent_user_id = :parentUserId
       AND pfsa.student_fee_assignment_id IN (${placeholders})`,
    { parentUserId, ...params },
  );

  return rows.map((row) => Number(row.student_fee_assignment_id));
}

function idParams(ids: number[]) {
  const params: Record<string, number> = {};
  const placeholders = ids.map((id, index) => {
    const key = `assignmentId${index}`;
    params[key] = id;
    return `:${key}`;
  }).join(", ");

  return { placeholders, params };
}

type ArchiveIdRow = RowDataPacket & {
  student_fee_assignment_id: number;
};
