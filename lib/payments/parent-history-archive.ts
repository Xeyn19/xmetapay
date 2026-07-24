import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type ParentPaymentHistoryArchiveOperation = "archive" | "restore" | "delete" | "recover";

const ARCHIVEABLE_STATUSES = ["paid", "failed", "voided", "refunded"] as const;

export async function updateParentPaymentHistoryArchiveState({
  parentUserId,
  paymentIds,
  operation,
}: {
  parentUserId: number;
  paymentIds: number[];
  operation: ParentPaymentHistoryArchiveOperation;
}) {
  const uniqueIds = [...new Set(paymentIds)].slice(0, 100);

  if (uniqueIds.length === 0) {
    return [];
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const updatedIds = operation === "archive"
      ? await archiveFinishedPayments(connection, parentUserId, uniqueIds)
      : operation === "restore"
        ? await restorePayments(connection, parentUserId, uniqueIds)
        : operation === "delete"
          ? await permanentlyHidePayments(connection, parentUserId, uniqueIds)
          : await recoverRemovedPayments(connection, parentUserId, uniqueIds);
    await connection.commit();
    return updatedIds;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recoverRemovedPayments(
  connection: PoolConnection,
  parentUserId: number,
  paymentIds: number[],
) {
  const { placeholders, params } = idParams(paymentIds);
  const [rows] = await connection.execute<ArchiveIdRow[]>(
    `SELECT ppha.payment_id
     FROM parent_payment_history_archives ppha
     JOIN payments p
       ON p.id = ppha.payment_id
      AND p.payer_user_id = :parentUserId
     JOIN students st ON st.id = p.student_id
     JOIN student_guardians sg
       ON sg.student_id = st.id
      AND sg.parent_user_id = :parentUserId
     WHERE ppha.parent_user_id = :parentUserId
       AND ppha.deleted_at IS NOT NULL
       AND DATE_ADD(ppha.deleted_at, INTERVAL 30 DAY) > CURRENT_TIMESTAMP
       AND ppha.payment_id IN (${placeholders})
     FOR UPDATE`,
    { parentUserId, ...params },
  );
  const recoveredIds = rows.map((row) => Number(row.payment_id));

  if (recoveredIds.length === 0) return [];

  const recoverable = idParams(recoveredIds);
  await connection.execute(
    `UPDATE parent_payment_history_archives
     SET deleted_at = NULL
     WHERE parent_user_id = :parentUserId
       AND deleted_at IS NOT NULL
       AND DATE_ADD(deleted_at, INTERVAL 30 DAY) > CURRENT_TIMESTAMP
       AND payment_id IN (${recoverable.placeholders})`,
    { parentUserId, ...recoverable.params },
  );
  return recoveredIds;
}

async function archiveFinishedPayments(
  connection: PoolConnection,
  parentUserId: number,
  paymentIds: number[],
) {
  const { placeholders, params } = idParams(paymentIds);

  await connection.execute(
    `INSERT IGNORE INTO parent_payment_history_archives
       (parent_user_id, payment_id, archived_at)
     SELECT :parentUserId, p.id, CURRENT_TIMESTAMP
     FROM payments p
     JOIN students st ON st.id = p.student_id
     JOIN student_guardians sg
       ON sg.student_id = st.id
      AND sg.parent_user_id = :parentUserId
     WHERE p.payer_user_id = :parentUserId
       AND p.id IN (${placeholders})
       AND p.status IN ('paid', 'failed', 'voided', 'refunded')`,
    { parentUserId, ...params },
  );

  return getOwnedArchivedIds(connection, parentUserId, paymentIds);
}

async function restorePayments(
  connection: PoolConnection,
  parentUserId: number,
  paymentIds: number[],
) {
  const updatedIds = await getOwnedArchivedIds(connection, parentUserId, paymentIds);

  if (updatedIds.length === 0) {
    return [];
  }

  const { placeholders, params } = idParams(updatedIds);
  await connection.execute(
    `DELETE FROM parent_payment_history_archives
     WHERE parent_user_id = :parentUserId
       AND payment_id IN (${placeholders})`,
    { parentUserId, ...params },
  );
  return updatedIds;
}

async function permanentlyHidePayments(
  connection: PoolConnection,
  parentUserId: number,
  paymentIds: number[],
) {
  const updatedIds = await getOwnedDeletableArchivedIds(connection, parentUserId, paymentIds);

  if (updatedIds.length === 0) {
    return [];
  }

  const { placeholders, params } = idParams(updatedIds);
  await connection.execute(
    `UPDATE parent_payment_history_archives
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE parent_user_id = :parentUserId
       AND deleted_at IS NULL
       AND payment_id IN (${placeholders})`,
    { parentUserId, ...params },
  );
  return updatedIds;
}

async function getOwnedDeletableArchivedIds(
  connection: PoolConnection,
  parentUserId: number,
  paymentIds: number[],
) {
  const { placeholders, params } = idParams(paymentIds);
  const [rows] = await connection.execute<ArchiveIdRow[]>(
    `SELECT ppha.payment_id
     FROM parent_payment_history_archives ppha
     JOIN payments p
       ON p.id = ppha.payment_id
      AND p.payer_user_id = :parentUserId
     JOIN students st ON st.id = p.student_id
     JOIN student_guardians sg
       ON sg.student_id = st.id
      AND sg.parent_user_id = :parentUserId
     WHERE ppha.parent_user_id = :parentUserId
       AND ppha.deleted_at IS NULL
       AND ppha.payment_id IN (${placeholders})
       AND p.status IN ('paid', 'failed', 'voided', 'refunded')
     FOR UPDATE`,
    { parentUserId, ...params },
  );

  return rows.map((row) => Number(row.payment_id));
}

async function getOwnedArchivedIds(
  connection: PoolConnection,
  parentUserId: number,
  paymentIds: number[],
) {
  const { placeholders, params } = idParams(paymentIds);
  const [rows] = await connection.execute<ArchiveIdRow[]>(
    `SELECT ppha.payment_id
     FROM parent_payment_history_archives ppha
     JOIN payments p
       ON p.id = ppha.payment_id
      AND p.payer_user_id = :parentUserId
     JOIN students st ON st.id = p.student_id
     JOIN student_guardians sg
       ON sg.student_id = st.id
      AND sg.parent_user_id = :parentUserId
     WHERE ppha.parent_user_id = :parentUserId
       AND ppha.deleted_at IS NULL
       AND ppha.payment_id IN (${placeholders})
     FOR UPDATE`,
    { parentUserId, ...params },
  );

  return rows.map((row) => Number(row.payment_id));
}

function idParams(ids: number[]) {
  const params: Record<string, number> = {};
  const placeholders = ids.map((id, index) => {
    const key = `paymentId${index}`;
    params[key] = id;
    return `:${key}`;
  }).join(", ");

  return { placeholders, params };
}

export function isParentPaymentHistoryArchiveEligible(status: string) {
  return ARCHIVEABLE_STATUSES.includes(status as (typeof ARCHIVEABLE_STATUSES)[number]);
}

type ArchiveIdRow = RowDataPacket & {
  payment_id: number;
};
