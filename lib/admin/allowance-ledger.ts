import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type AllowanceLedgerArchiveScope = "active" | "archived" | "all";

export type AllowanceLedgerSqlRow = RowDataPacket & {
  wallet_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  balance: number | string;
  wallet_status: string;
  last_top_up_at: Date | string | null;
  monthly_spend: number | string;
  total_top_ups: number | string;
  archived_at: Date | string | null;
};

export async function getAllowanceLedgerRows(
  schoolId: number,
  schoolYearId: number,
  archiveScope: AllowanceLedgerArchiveScope = "all",
) {
  const archiveFilter = archiveScope === "active"
    ? "AND wla.archived_at IS NULL"
    : archiveScope === "archived"
      ? "AND wla.archived_at IS NOT NULL"
      : "";
  const [rows] = await pool.execute<AllowanceLedgerSqlRow[]>(
    `SELECT w.id AS wallet_id,
       st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(w.balance, 0) AS balance,
       w.status AS wallet_status,
       MAX(CASE WHEN wt.type = 'top_up' THEN wt.created_at END) AS last_top_up_at,
       COALESCE(SUM(CASE WHEN wt.type = 'purchase' AND wt.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') THEN ABS(wt.amount) ELSE 0 END), 0) AS monthly_spend,
       COALESCE(SUM(CASE WHEN wt.type = 'top_up' THEN wt.amount ELSE 0 END), 0) AS total_top_ups,
       wla.archived_at
     FROM wallets w
     JOIN students st ON st.id = w.student_id
     JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
      AND (wt.school_year_id = :schoolYearId OR wt.school_year_id IS NULL)
     LEFT JOIN wallet_ledger_archives wla
       ON wla.wallet_id = w.id
      AND wla.school_year_id = :schoolYearId
     WHERE st.school_id = :schoolId
       ${archiveFilter}
     GROUP BY w.id, st.first_name, st.middle_name, st.last_name, gl.name,
       w.balance, w.status, wla.archived_at
     ORDER BY st.last_name ASC, st.first_name ASC`,
    { schoolId, schoolYearId },
  );

  return rows;
}

export async function updateAllowanceLedgerArchiveState({
  schoolId,
  schoolYearId,
  walletIds,
  operation,
}: {
  schoolId: number;
  schoolYearId: number;
  walletIds: number[];
  operation: "archive" | "restore";
}) {
  const params: Record<string, number> = { schoolId, schoolYearId };
  const placeholders = walletIds.map((walletId, index) => {
    const key = `walletId${index}`;
    params[key] = walletId;
    return `:${key}`;
  });
  const [eligibleRows] = await pool.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT w.id
     FROM wallets w
     JOIN students st ON st.id = w.student_id
     JOIN enrollments e
       ON e.student_id = st.id
      AND e.school_year_id = :schoolYearId
     WHERE st.school_id = :schoolId
       AND w.id IN (${placeholders.join(", ")})`,
    params,
  );
  const eligibleIds = eligibleRows.map((row) => Number(row.id));

  if (eligibleIds.length === 0) return 0;

  if (operation === "archive") {
    const archiveParams: Record<string, number> = { schoolYearId };
    const values = eligibleIds.map((walletId, index) => {
      const key = `eligibleWalletId${index}`;
      archiveParams[key] = walletId;
      return `(:${key}, :schoolYearId, CURRENT_TIMESTAMP)`;
    });

    await pool.execute(
      `INSERT INTO wallet_ledger_archives (wallet_id, school_year_id, archived_at)
       VALUES ${values.join(", ")}
       ON DUPLICATE KEY UPDATE archived_at = CURRENT_TIMESTAMP`,
      archiveParams,
    );
  } else {
    const restoreParams: Record<string, number> = { schoolYearId };
    const restorePlaceholders = eligibleIds.map((walletId, index) => {
      const key = `eligibleWalletId${index}`;
      restoreParams[key] = walletId;
      return `:${key}`;
    });

    await pool.execute(
      `DELETE FROM wallet_ledger_archives
       WHERE school_year_id = :schoolYearId
         AND wallet_id IN (${restorePlaceholders.join(", ")})`,
      restoreParams,
    );
  }

  return eligibleIds.length;
}
